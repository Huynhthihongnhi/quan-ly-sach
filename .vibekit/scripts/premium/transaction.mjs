import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assert, digest, fileHash, json, KitError, projectRoot, readJson, safePath, sha256, uniquePaths} from './common.mjs';

const LOCAL = '.vibekit/local';
const ACTIVE = `${LOCAL}/transaction-active`;
const JOURNALS = `${LOCAL}/transactions`;
const hashPattern = /^[a-f0-9]{64}$/;
function allowedDestination(rel) {
  if (rel.split('/').some(part => /^(?:\.git|\.env.*)$|secret|token|credential/i.test(part))) return false;
  return /^\.(?:vibekit|claude|cursor|agents|grok|kimi-code|github)\/skills\/[a-z][a-z0-9-]*\//.test(rel)
    || rel === '.vibekit/skill.lock.json' || rel === '.gitignore'
    || /^\.vibekit\/tasks\/[a-z][a-z0-9-]*\/(?:task\.json|TASK\.md)$/.test(rel);
}
export function makePlan(target, action, changes, metadata = {}) {
  const root = projectRoot(target);
  uniquePaths(changes.map(c => c.path));
  const operations = changes.map(change => {
    assert(allowedDestination(change.path), 'SCOPE_ESCAPE', `Unsupported mutation path: ${change.path}`);
    const before = fileHash(root, change.path);
    const data = change.data === null ? null : Buffer.from(change.data);
    const after = data === null ? null : sha256(data);
    return {path:change.path, before, after, action:after === before ? 'unchanged' : after === null ? 'archive' : before === null ? 'add' : 'replace', ownership:change.ownership || 'managed', reason:change.reason || action, data};
  });
  const publicPlan = {schemaVersion:1, target:root, action, metadata, operations:operations.map(({data,...op}) => op)};
  return {...publicPlan, sha256:digest(publicPlan), operations};
}
export function publicPlan(plan) { return {...plan, operations:plan.operations.map(({data,...op}) => op)}; }
function ensureDirectory(root, rel, created = []) {
  const parts = rel.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const name = parts.slice(0, i).join('/');
    const dir = safePath(root, name);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir); created.push(name); }
    assert(fs.statSync(dir).isDirectory(), 'PATH_COLLISION', 'Expected directory.');
  }
}
function saveJournal(root, rel, value) {
  const file = safePath(root, rel);
  const temp = `${rel}.next`;
  const next = safePath(root, temp);
  assert(!fs.existsSync(next), 'JOURNAL_CONFLICT', 'Pending journal write requires recovery.', 9);
  const fd = fs.openSync(next, 'wx', 0o600);
  try { fs.writeFileSync(fd, json(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(safePath(root, temp), safePath(root, rel));
  return file;
}
function verifyPreimage(root, op) {
  assert(fileHash(root, op.path) === op.before, 'STALE_PLAN', `Target changed since preview: ${op.path}`, 7);
}
function release(root, id) {
  // Move the mutex into the receipt directory. Recovery remains inspectable.
  const active = safePath(root, ACTIVE);
  if (fs.existsSync(active)) fs.renameSync(active, safePath(root, `${JOURNALS}/${id}/released-mutex`));
}
function validateReceipt(receipt, id, root) {
  assert(receipt.schemaVersion === 1 && receipt.id === id && receipt.target === root && Array.isArray(receipt.operations), 'INVALID_RECEIPT', 'Invalid transaction receipt.', 9);
  uniquePaths(receipt.operations.map(op => op.path));
  for (const op of receipt.operations) {
    assert(allowedDestination(op.path) && (op.before === null || hashPattern.test(op.before)) && (op.after === null || hashPattern.test(op.after)), 'INVALID_RECEIPT', 'Unsafe receipt operation.', 9);
  }
  assert(Array.isArray(receipt.createdDirectories) && receipt.createdDirectories.every(rel => typeof rel === 'string' && receipt.operations.some(op => op.path.startsWith(`${rel}/`))), 'INVALID_RECEIPT', 'Unexpected recovery directory.', 9);
}
function checkRestoration(root, receipt) {
  const base = `${JOURNALS}/${receipt.id}`;
  for (let i = 0; i < receipt.operations.length; i++) {
    const op = receipt.operations[i], current = fileHash(root,op.path);
    if (current === op.before) continue;
    const backupHash = fileHash(root,`${base}/before/${i}`);
    assert(current === op.after || (current === null && backupHash === op.before), 'RECOVERY_CONFLICT', `Preserve newer user changes before recovery: ${op.path}`, 9);
    assert(op.before === null || backupHash === op.before, 'RECOVERY_BACKUP', `Missing or changed pre-image: ${op.path}`, 9);
  }
}
function restore(root, receipt) {
  const base = `${JOURNALS}/${receipt.id}`;
  // Catch known conflicts across the entire receipt before restoring any file.
  checkRestoration(root,receipt);
  for (let i = receipt.operations.length - 1; i >= 0; i--) {
    const op = receipt.operations[i];
    const current = fileHash(root, op.path);
    if (current === op.before) continue;
    const backupRel = `${base}/before/${i}`;
    const backupHash = fileHash(root, backupRel);
    // A crash may occur between archiving the old file and publishing its replacement.
    assert(current === op.after || (current === null && backupHash === op.before), 'RECOVERY_CONFLICT', `Preserve newer user changes before recovery: ${op.path}`, 9);
    assert(op.before === null || backupHash === op.before, 'RECOVERY_BACKUP', `Missing or changed pre-image: ${op.path}`, 9);
    if (current !== null) {
      ensureDirectory(root, `${base}/quarantine`);
      const quarantine = `${base}/quarantine/${i}-${randomUUID()}`;
      fs.renameSync(safePath(root, op.path), safePath(root, quarantine));
    }
    if (op.before !== null) {
      ensureDirectory(root, path.posix.dirname(op.path));
      const temp = `${base}/stage/restore-${i}-${randomUUID()}`;
      fs.copyFileSync(safePath(root, backupRel), safePath(root, temp), fs.constants.COPYFILE_EXCL);
      assert(fileHash(root, temp) === op.before && fileHash(root, op.path) === null, 'RECOVERY_DRIFT', 'Recovery target changed.', 9);
      fs.renameSync(safePath(root, temp), safePath(root, op.path));
    }
    assert(fileHash(root, op.path) === op.before, 'RECOVERY_FAILED', `Restoration verification failed: ${op.path}`, 9);
  }
  // Only remove empty directories created by this transaction, never recursive user paths.
  for (const rel of [...(receipt.createdDirectories || [])].reverse()) {
    if (rel.startsWith(LOCAL) || rel === '.vibekit') continue;
    const dir = safePath(root, rel);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }
}
export function applyPlan(plan, {acceptedDigest, nonInteractive = false, validate = () => {}, fault = () => {}} = {}) {
  const root = projectRoot(plan.target);
  const view = publicPlan(plan), {sha256:expected, ...bound} = view;
  assert(digest(bound) === expected, 'PLAN_TAMPERED', 'Plan contents no longer match the digest.', 7);
  assert(!nonInteractive || acceptedDigest, 'PLAN_APPROVAL_REQUIRED', 'Non-interactive apply requires --accept-plan-sha256.', 3);
  assert(acceptedDigest === expected, 'PLAN_APPROVAL_REQUIRED', 'Approve the exact current plan digest before applying.', 3);
  const operations = plan.operations.filter(op => op.action !== 'unchanged');
  for (const op of plan.operations) {
    assert(allowedDestination(op.path), 'SCOPE_ESCAPE', 'Unsupported transaction destination.');
    assert(op.data === null ? op.after === null : sha256(op.data) === op.after, 'SOURCE_CHANGED', 'Staged content differs from approved plan.', 7);
    verifyPreimage(root, op);
  }
  assert(!fs.existsSync(safePath(root, ACTIVE)), 'TRANSACTION_PENDING', 'A transaction is active or interrupted. Inspect transaction status before recovery.', 9);
  if (!operations.length) return {schemaVersion:1, status:'unchanged', planSha256:expected};
  ensureDirectory(root, LOCAL);
  const ignore = safePath(root, `${LOCAL}/.gitignore`);
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n', {flag:'wx',mode:0o600});
  try { fs.mkdirSync(safePath(root, ACTIVE)); } catch (error) { if (error.code === 'EEXIST') throw new KitError('TRANSACTION_PENDING', 'Another writer holds the transaction mutex.', 9); throw error; }
  const id = randomUUID(), base = `${JOURNALS}/${id}`, receiptRel = `${base}/receipt.json`;
  const receipt = {schemaVersion:1,id,target:root,planSha256:expected,action:plan.action,status:'prepared',pid:process.pid,createdAt:new Date().toISOString(),createdDirectories:[],operations:operations.map(({data,...op}) => op)};
  try {
    ensureDirectory(root, `${base}/before`); ensureDirectory(root, `${base}/stage`);
    fs.writeFileSync(safePath(root, `${ACTIVE}/owner.json`), json({id,pid:process.pid}), {flag:'wx',mode:0o600});
    saveJournal(root, receiptRel, receipt);
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.data !== null) {
        const fd=fs.openSync(safePath(root, `${base}/stage/${i}`), 'wx', 0o644);
        try { fs.writeFileSync(fd,op.data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      }
    }
    fault('staged', -1);
    receipt.status = 'applying'; saveJournal(root, receiptRel, receipt);
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      verifyPreimage(root, op);
      const parent = path.posix.dirname(op.path);
      if (parent !== '.') ensureDirectory(root, parent, receipt.createdDirectories);
      saveJournal(root, receiptRel, receipt);
      if (op.before !== null) {
        verifyPreimage(root, op);
        fs.renameSync(safePath(root, op.path), safePath(root, `${base}/before/${i}`));
        assert(fileHash(root, `${base}/before/${i}`) === op.before, 'PREIMAGE_CHANGED', 'Pre-image changed during archive.', 7);
      }
      fault('archived', i);
      assert(fileHash(root, op.path) === null, 'STALE_PLAN', `Destination appeared during apply: ${op.path}`, 7);
      if (op.data !== null) fs.renameSync(safePath(root, `${base}/stage/${i}`), safePath(root, op.path));
      fault('published', i);
      assert(fileHash(root, op.path) === op.after, 'APPLY_MISMATCH', 'Published content failed verification.', 8);
    }
    validate(root);
    for (const op of plan.operations) assert(fileHash(root, op.path) === op.after, 'POST_APPLY_DRIFT', `Post-apply drift: ${op.path}`, 8);
    fault('validated', -1);
    receipt.status = 'committed'; receipt.finishedAt = new Date().toISOString(); saveJournal(root, receiptRel, receipt);
    release(root, id);
    return {schemaVersion:1,id,status:'committed',planSha256:expected,receipt:receiptRel,changed:operations.length};
  } catch (error) {
    try {
      restore(root, receipt);
      receipt.status = 'rolled-back'; receipt.failureCode = error.code || 'APPLY_FAILED'; receipt.finishedAt = new Date().toISOString();
      saveJournal(root, receiptRel, receipt); release(root, id);
    } catch (rollbackError) {
      throw new KitError('RECOVERY_REQUIRED', `Transaction ${id} requires recovery (${rollbackError.code || 'IO_ERROR'}). Backups are retained.`, 9);
    }
    throw new KitError('APPLY_ROLLED_BACK', `Transaction ${id} failed (${error.code || 'IO_ERROR'}); pre-images verified restored.`, 8);
  }
}
export function transactionStatus(target) {
  const root = projectRoot(target), dir = safePath(root, JOURNALS);
  const transactions = !fs.existsSync(dir) ? [] : fs.readdirSync(dir).filter(id => /^[0-9a-f-]{36}$/.test(id)).map(id => {
    const file = safePath(root, `${JOURNALS}/${id}/receipt.json`);
    if (!fs.existsSync(file)) return {id,status:'incomplete'};
    const receipt = readJson(file); validateReceipt(receipt,id,root);
    return {id,status:receipt.status,action:receipt.action,planSha256:receipt.planSha256};
  });
  const ownerFile = safePath(root, `${ACTIVE}/owner.json`);
  return {schemaVersion:1,active:fs.existsSync(ownerFile) ? readJson(ownerFile) : fs.existsSync(safePath(root, ACTIVE)) ? {status:'owner-missing'} : null,transactions};
}
export function rollbackTransaction(target, id, {apply = false, acceptedDigest} = {}) {
  const root = projectRoot(target);
  assert(/^[0-9a-f-]{36}$/.test(id || ''), 'INVALID_TRANSACTION', 'A transaction UUID is required.');
  const rel = `${JOURNALS}/${id}/receipt.json`, receipt = readJson(safePath(root,rel));
  validateReceipt(receipt,id,root);
  const current = receipt.operations.map(op => ({path:op.path,hash:fileHash(root,op.path)}));
  const preview = {schemaVersion:1,action:'rollback',id,receiptDigest:digest(receipt),current};
  preview.sha256 = digest(preview);
  if (!apply) return preview;
  assert(acceptedDigest === preview.sha256, 'PLAN_APPROVAL_REQUIRED', 'Approve the current rollback digest.', 3);
  const active = transactionStatus(root).active;
  assert(!active || active.id === id, 'TRANSACTION_PENDING', 'Another transaction requires recovery.', 9);
  if (active?.pid) {
    let running = false;
    try { process.kill(active.pid, 0); running = true; } catch (error) { assert(error.code === 'ESRCH', 'WRITER_UNKNOWN', 'Cannot verify writer exit.', 9); }
    assert(!running, 'WRITER_ACTIVE', 'The transaction writer is still running.', 9);
  }
  checkRestoration(root,receipt);
  if (!active) { fs.mkdirSync(safePath(root,ACTIVE)); fs.writeFileSync(safePath(root,`${ACTIVE}/owner.json`),json({id,pid:process.pid}),{flag:'wx',mode:0o600}); }
  restore(root,receipt);
  // A process can exit while writing the next receipt. The previous atomic
  // receipt remains authoritative; retain the incomplete write as evidence.
  const pending=safePath(root,`${rel}.next`);
  if (fs.existsSync(pending)) fs.renameSync(pending,safePath(root,`${JOURNALS}/${id}/pending-receipt-${randomUUID()}`));
  receipt.status='rolled-back'; receipt.finishedAt=new Date().toISOString(); saveJournal(root,rel,receipt);
  // Each recovery retains its own mutex record without replacing earlier evidence.
  fs.renameSync(safePath(root,ACTIVE),safePath(root,`${JOURNALS}/${id}/recovery-mutex-${randomUUID()}`));
  return {schemaVersion:1,id,status:'rolled-back',verified:true};
}
