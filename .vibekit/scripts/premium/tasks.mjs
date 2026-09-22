import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assert, digest, fileHash, json, projectRoot, readJson, redact, relativePath, safePath} from './common.mjs';
import {applyPlan,makePlan} from './transaction.mjs';

export const PHASES = ['inspect','target','explore','execute','verify','closed','blocked'];
export const EVIDENCE_TYPES = ['static','unit','contract','integration','e2e','visual','manual'];
export const EVIDENCE_STATUS = ['passed','failed','not run','blocked'];
const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function idsUnique(items, label) { assert(Array.isArray(items) && items.every(x => nonempty(x.id)) && new Set(items.map(x => x.id)).size === items.length,'TASK_SCHEMA',`${label} need unique IDs.`); }
function containsSensitivePath(rel) { return rel.split('/').some(p => /^(?:\.git|node_modules|dist|build|coverage|\.env.*)$|secret|token|credential|private[-_]?key/i.test(p)); }
export function safeTaskData(value) {
  function visit(item) {
    if (typeof item === 'string') return redact(item);
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(item)) {
        assert(!/^(?:__proto__|constructor|password|secret|token|accessToken|refreshToken|privateKey|licenseKey|authorization)$/i.test(key), 'SENSITIVE_TASK_DATA','Credential fields are prohibited in task records.');
        result[key] = visit(val);
      }
      return result;
    }
    return item;
  }
  return visit(value);
}
function matchesScope(file, scope) { return scope.some(p => p === '.' || file === p.replace(/\/$/,'') || file.startsWith(`${p.replace(/\/$/,'')}/`)); }
export function contextSnapshot(target, scope) {
  const root = projectRoot(target), files = {};
  assert(Array.isArray(scope) && scope.length && scope.every(nonempty), 'TASK_SCOPE','List the task input paths.');
  for (const rel of scope) if (rel !== '.') relativePath(rel.replace(/\/$/,''));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = args => spawnSync('git',['--no-optional-locks','-c','core.fsmonitor=false','-C',root,...args],{encoding:'utf8',env,timeout:10000,maxBuffer:8*1024*1024});
  const listed = git(['ls-files','-z','--cached','--others','--exclude-standard']);
  const paths = new Set(listed.status === 0 ? listed.stdout.split('\0').filter(rel => rel && matchesScope(rel,scope)) : []);
  function walk(rel) {
    if (rel && (containsSensitivePath(rel) || rel.startsWith('.vibekit/local') || rel.startsWith('.vibekit/tasks'))) return;
    const absolute = rel ? safePath(root,rel) : root;
    if (!fs.existsSync(absolute)) { if (rel) paths.add(rel); return; }
    const stat=fs.lstatSync(absolute);
    if (stat.isDirectory()) for (const name of fs.readdirSync(absolute).sort()) walk(rel ? `${rel}/${name}` : name);
    else if (matchesScope(rel,scope)) paths.add(rel);
    assert(paths.size <= 20000,'CONTEXT_LIMIT','Scope exceeds 20,000 files; narrow the task.');
  }
  // Broad Git scopes respect ignore rules. Explicit input paths must still be
  // observed, including ignored inputs and files that do not exist yet.
  for (const rel of scope) if (listed.status !== 0 || rel !== '.') walk(rel === '.' ? '' : rel.replace(/\/$/,''));
  assert(paths.size <= 20000,'CONTEXT_LIMIT','Scope exceeds 20,000 files; narrow the task.');
  for (const rel of [...paths].sort()) {
    if (!matchesScope(rel,scope) || containsSensitivePath(rel) || rel.startsWith('.vibekit/tasks/') || rel.startsWith('.vibekit/local/')) continue;
    const file=safePath(root,rel);
    assert(!fs.existsSync(file) || fs.statSync(file).size <= 8*1024*1024,'CONTEXT_LIMIT','Context file exceeds 8 MiB.');
    files[rel]=fileHash(root,rel);
  }
  for (const rel of ['backbone.yml','AGENTS.md','CLAUDE.md']) if (fs.existsSync(safePath(root,rel))) files[rel]=fileHash(root,rel);
  const head=git(['rev-parse','--verify','HEAD']);
  const snapshot={schemaVersion:1,head:head.status === 0 ? head.stdout.trim() : null,files};
  return {...snapshot,digest:digest(snapshot)};
}
export function taskContract(task) { return {goal:task.goal,scope:task.scope,nonGoals:task.nonGoals,criteria:task.criteria,risk:task.risk,budget:task.budget}; }
export function validateTask(task) {
  assert(task?.schemaVersion === 1 && idPattern.test(task.id) && Number.isInteger(task.revision) && task.revision > 0,'TASK_SCHEMA','Invalid task identity or revision.');
  assert(nonempty(task.goal) && ['low','medium','high'].includes(task.risk) && PHASES.includes(task.phase),'TASK_SCHEMA','Goal, risk and phase are required.');
  assert(Array.isArray(task.scope) && task.scope.length && Array.isArray(task.nonGoals),'TASK_SCHEMA','Scope and nonGoals are required.');
  for (const rel of task.scope) if (rel !== '.') { relativePath(rel.replace(/\/$/,'')); assert(!containsSensitivePath(rel),'TASK_SCOPE','Sensitive task input paths are prohibited.'); }
  for (const name of ['criteria','questions','assumptions','claims','decisions','tickets','evidence']) idsUnique(task[name],name);
  assert(task.criteria.length,'TASK_SCHEMA','At least one acceptance criterion is required.');
  for (const criterion of task.criteria) assert(nonempty(criterion.description) && Array.isArray(criterion.requires) && criterion.requires.length && criterion.requires.every(type => EVIDENCE_TYPES.includes(type)),'TASK_SCHEMA','Each criterion needs a description and required evidence types.');
  assert(Number.isInteger(task.budget?.maxIterations) && task.budget.maxIterations > 0 && Number.isInteger(task.budget?.maxMinutes) && task.budget.maxMinutes > 0,'TASK_BUDGET','Set positive iteration and wall-time limits.');
  assert(task.contractDigest === digest(taskContract(task)),'TASK_CONTRACT_DRIFT','Task contract changed without a revision.');
  assert(task.context?.schemaVersion === 1 && task.context.files && task.context.digest === digest({schemaVersion:1,head:task.context.head,files:task.context.files}),'TASK_CONTEXT','Invalid context snapshot or digest.');
  for (const question of task.questions) assert(nonempty(question.question) && typeof question.blocking === 'boolean' && (question.answer === undefined || typeof question.answer === 'string'),'QUESTION_SCHEMA','Questions need text, an explicit blocking flag and an optional text answer.');
  for (const decision of task.decisions) {
    assert(Array.isArray(decision.options) && decision.options.length > 0 && decision.options.every(option => nonempty(option.id) && nonempty(option.description)),'DECISION_SCHEMA','Decisions need named options and descriptions.');
    if (decision.selected) assert(decision.options.some(option => option.id === decision.selected) && nonempty(decision.reason),'DECISION_SCHEMA','Selected option and reason must match the decision.');
    if (decision.prototype) {
      const prototype=decision.prototype;
      assert(nonempty(prototype.question) && Number.isInteger(prototype.maxMinutes) && prototype.maxMinutes > 0 && prototype.maxMinutes <= task.budget.maxMinutes && Number.isInteger(prototype.iterations) && prototype.iterations >= 0 && prototype.iterations <= task.budget.maxIterations && ['planned','integrate','preserve','discard'].includes(prototype.disposition),'PROTOTYPE_BUDGET','Prototype needs an uncertainty, time limit, bounded iterations and disposition.');
      if (prototype.disposition !== 'planned') assert(nonempty(prototype.evidence),'PROTOTYPE_EVIDENCE','Completed prototype needs an evidence reference.');
    }
  }
  for (const item of task.evidence) {
    assert(EVIDENCE_TYPES.includes(item.type) && EVIDENCE_STATUS.includes(item.status) && task.criteria.some(c => c.id === item.criterion),'EVIDENCE_SCHEMA','Evidence must name a current criterion, type and status.');
    assert(item.revision === task.revision && item.contextDigest === task.context.digest,'EVIDENCE_STALE','Evidence belongs to an older task revision or context.');
    if (item.status === 'passed') {
      assert(nonempty(item.observation) && nonempty(item.reference) && /^[a-f0-9]{64}$/.test(item.sha256) && nonempty(item.observedAt),'EVIDENCE_MISSING','Passed evidence needs an observation, local artifact, digest and timestamp.');
      relativePath(item.reference); assert(!containsSensitivePath(item.reference),'EVIDENCE_PATH','Sensitive evidence paths are prohibited.');
      if (!['manual','visual'].includes(item.type)) assert(Array.isArray(item.command) && item.command.length && item.command.every(nonempty) && item.exitCode === 0,'EVIDENCE_COMMAND','Passed executable evidence needs exact argv and exit code zero.');
    }
  }
  for (const ticket of task.tickets) {
    assert(nonempty(ticket.owner) && Array.isArray(ticket.paths) && ticket.paths.length && ticket.paths.every(p => nonempty(p) && matchesScope(p,task.scope)) && Array.isArray(ticket.criteria) && ticket.criteria.length && ticket.criteria.every(id => task.criteria.some(c => c.id === id)),'TICKET_SCOPE','Tickets need an owner, contained paths and current criteria.');
    for (const rel of ticket.paths) { if (rel !== '.') relativePath(rel.replace(/\/$/,'')); assert(!containsSensitivePath(rel),'TICKET_SCOPE','Sensitive ticket paths are prohibited.'); }
    assert(['planned','active','done','blocked','cancelled','stale'].includes(ticket.status),'TICKET_STATUS','Invalid ticket status.');
    assert(ticket.revision === task.revision,'TICKET_STALE','Ticket belongs to an older revision.');
  }
  const active=task.tickets.filter(t => t.status === 'active');
  for (let i=0;i<active.length;i++) for (let j=i+1;j<active.length;j++) if (active[i].owner !== active[j].owner) assert(!active[i].paths.some(a => active[j].paths.some(b => matchesScope(a,[b]) || matchesScope(b,[a]))),'WRITER_OVERLAP','Active ticket write scopes overlap.');
  safeTaskData(task);
  return task;
}
export function createTask(target,id,brief) {
  assert(idPattern.test(id),'TASK_ID','Use a lowercase task ID with hyphens.');
  assert(brief && typeof brief === 'object' && !Array.isArray(brief) && Object.keys(brief).every(key => ['goal','risk','scope','nonGoals','criteria','budget','questions','assumptions','claims'].includes(key)), 'TASK_SCHEMA','Unknown task brief field.');
  brief=safeTaskData(brief);
  const task={schemaVersion:1,id,revision:1,phase:'target',goal:brief.goal,risk:brief.risk || 'medium',scope:brief.scope || ['.'],nonGoals:brief.nonGoals || [],criteria:brief.criteria || [],budget:brief.budget || {maxIterations:3,maxMinutes:60},questions:brief.questions || [],assumptions:brief.assumptions || [],claims:brief.claims || [],decisions:[],tickets:[],evidence:[],history:[]};
  task.context=contextSnapshot(target,task.scope); task.contractDigest=digest(taskContract(task));
  return validateTask(task);
}
export function loadTask(target,id) {
  assert(idPattern.test(id || ''),'TASK_ID','A task ID is required.');
  return validateTask(readJson(safePath(projectRoot(target),`.vibekit/tasks/${id}/task.json`)));
}
export function verifyTask(target,task,{now=Date.now()}={}) {
  validateTask(task);
  const current=contextSnapshot(target,task.scope), blockers=[];
  if (current.digest !== task.context.digest) blockers.push('context-drift');
  for (const q of task.questions) if (q.blocking === true && !nonempty(q.answer)) blockers.push(`question:${q.id}`);
  for (const ticket of task.tickets) if (!['done','cancelled'].includes(ticket.status)) blockers.push(`ticket:${ticket.id}`);
  for (const decision of task.decisions) if (!decision.selected || decision.prototype?.disposition === 'planned') blockers.push(`decision:${decision.id}`);
  for (const assumption of task.assumptions) if (assumption.blocking === true && (!Number.isFinite(Date.parse(assumption.expiresAt)) || Date.parse(assumption.expiresAt) <= now)) blockers.push(`assumption:${assumption.id}`);
  for (const claim of task.claims) {
    if (claim.material === false) continue;
    if (claim.status !== 'verified' || !nonempty(claim.source) || (claim.stability !== 'pinned' && (!Number.isFinite(Date.parse(claim.refreshAfter)) || Date.parse(claim.refreshAfter) <= now)) || claim.contradicted === true) blockers.push(`claim:${claim.id}`);
  }
  const validEvidence=new Set();
  for (const evidence of task.evidence) {
    if (evidence.status !== 'passed') continue;
    const observed=Date.parse(evidence.observedAt);
    if (!Number.isFinite(observed) || observed > now || fileHash(projectRoot(target),evidence.reference) !== evidence.sha256) { blockers.push(`evidence-drift:${evidence.id}`); continue; }
    validEvidence.add(evidence.id);
  }
  const criteria=task.criteria.map(criterion => {
    const records=task.evidence.filter(e => e.criterion === criterion.id);
    const missing=criterion.requires.filter(type => !records.some(e => e.type === type && validEvidence.has(e.id)));
    const failed=records.some(e => e.status === 'failed');
    const blocked=records.some(e => e.status === 'blocked');
    const status=failed ? 'failed' : blocked ? 'blocked' : missing.length ? 'not run' : 'passed';
    return {id:criterion.id,description:criterion.description,status,missing,evidence:records.map(e => e.id)};
  });
  for (const criterion of criteria) if (criterion.status !== 'passed') blockers.push(`criterion:${criterion.id}`);
  return {schemaVersion:1,task:task.id,revision:task.revision,status:blockers.length ? 'blocked' : 'passed',contextDigest:current.digest,criteria,blockers,provenance:'Evidence file hashes checked; command observations are supplied by the operator, not independently authenticated.'};
}
const cell = value => redact(String(value)).replaceAll('|','\\|').replace(/[\r\n]+/g,' ');
export function renderTask(task,verification) {
  const lines=[`# ${cell(task.goal)}`,'',`Task: ${task.id}; revision: ${task.revision}; phase: ${task.phase}.`,'','## Target contract','',`- Goal: ${cell(task.goal)}`,`- Scope: ${task.scope.map(cell).join(', ')}`,`- Non-goals: ${task.nonGoals.map(cell).join('; ') || 'none recorded'}`,`- Budget: ${task.budget.maxIterations} iterations, ${task.budget.maxMinutes} minutes.`,'','## Acceptance and evidence','', '| Criterion | Status | Evidence |','| --- | --- | --- |'];
  for (const criterion of verification.criteria) lines.push(`| ${cell(criterion.id)}: ${cell(criterion.description)} | ${criterion.status} | ${criterion.evidence.map(cell).join(', ') || 'none'} |`);
  lines.push('','## Decisions','');
  for (const decision of task.decisions) lines.push(`- ${cell(decision.id)}: ${cell(decision.selected || 'unresolved')}. ${cell(decision.reason || '')}`);
  lines.push('','## Final decision report','',`**Done:** ${verification.criteria.filter(c => c.status === 'passed').map(c => cell(c.id)).join(', ') || 'No acceptance criteria verified yet.'}`,`\n**Evidence:** ${cell(verification.provenance)}`,`\n**Next:** ${verification.blockers.map(cell).join(', ') || 'none'}`);
  const unanswered=task.questions.filter(q => q.blocking && !q.answer);
  if (unanswered.length) lines.push(`\n**Decision needed:** ${unanswered.map(q => cell(q.question || q.id)).join('; ')}`);
  lines.push(`\n**Known gaps:** ${verification.status === 'passed' ? 'Independent execution attestation is not available.' : 'Closure remains blocked until the listed evidence and context gaps are resolved.'}`,'');
  return lines.join('\n');
}
export function planTask(target,id,action,input={}) {
  const root=projectRoot(target), rel=`.vibekit/tasks/${id}/task.json`;
  let task;
  if (action === 'start') { assert(!fs.existsSync(safePath(root,rel)),'TASK_EXISTS','Task already exists.'); task=createTask(root,id,input); }
  else {
    task=loadTask(root,id);
    if (action === 'revise') {
      const allowed=['goal','scope','nonGoals','criteria','risk','budget'];
      assert(Object.keys(input).length && Object.keys(input).every(key => allowed.includes(key)), 'TASK_REVISION_SCOPE','Revise only the target contract fields.');
      task.history.push({revision:task.revision,contractDigest:task.contractDigest,contextDigest:task.context.digest,evidenceDigest:digest(task.evidence),reason:'Target revised; prior tickets and evidence invalidated.'});
      Object.assign(task,safeTaskData(input)); task.revision++; task.context=contextSnapshot(root,task.scope); task.evidence=[]; task.tickets=[]; task.decisions=[]; task.phase='target'; task.contractDigest=digest(taskContract(task));
    } else if (action === 'refresh-context') {
      task.history.push({revision:task.revision,contractDigest:task.contractDigest,contextDigest:task.context.digest,evidenceDigest:digest(task.evidence),reason:'Context refresh invalidated prior evidence.'});
      task.revision++; task.context=contextSnapshot(root,task.scope); task.evidence=[]; task.tickets=task.tickets.map(t => ({...t,revision:task.revision,status:'stale'})); task.phase='target';
    } else if (action === 'record') {
      assert(task.phase !== 'closed','TASK_CLOSED','Revise or refresh a closed task before recording new evidence.');
      const allowed=['questions','assumptions','claims','decisions','tickets','evidence'];
      assert(Object.keys(input).every(key => allowed.includes(key)),'TASK_RECORD_SCOPE','record accepts questions, assumptions, claims, decisions, tickets and evidence only.');
      Object.assign(task,safeTaskData(input));
    } else if (action === 'advance') {
      assert(PHASES.includes(input.phase) && input.phase !== 'closed','TASK_PHASE','Use finish for closure.');
      const from=PHASES.indexOf(task.phase), to=PHASES.indexOf(input.phase);
      assert(input.phase === 'blocked' || (to === from + 1 && to < 5),'TASK_TRANSITION','Advance one phase at a time; refresh context to reopen.');
      if (['explore','execute'].includes(input.phase)) assert(!task.questions.some(q => q.blocking && !q.answer),'TASK_QUESTION','Resolve blocking questions first.',3);
      if (input.phase === 'execute' && task.risk === 'high') assert(task.decisions.some(d => Array.isArray(d.options) && d.options.length >= 2 && nonempty(d.selected) && nonempty(d.reason)),'TASK_DECISION','High-risk execution requires an evidence-based option decision.',3);
      task.phase=input.phase;
    } else if (action === 'finish') {
      assert(task.phase === 'verify','TASK_PHASE','Advance to verify before finishing.');
      assert(verifyTask(root,task).status === 'passed','TASK_NOT_VERIFIED','Acceptance evidence or context is incomplete. Run task verify.',3); task.phase='closed';
    } else assert(false,'TASK_ACTION','Unknown task action.');
  }
  validateTask(task);
  const verification=verifyTask(root,task);
  return makePlan(root,`task ${action}`,[{path:rel,data:json(task),reason:'Versioned task contract'},{path:`.vibekit/tasks/${id}/TASK.md`,data:renderTask(task,verification),reason:'Readable target and evidence report'}],{task:id,verification});
}
export function interview(task) {
  validateTask(task);
  const limits={low:1,medium:3,high:6};
  const questions=task.questions.filter(q => !q.answer).sort((a,b) => Number(b.blocking)-Number(a.blocking)).slice(0,limits[task.risk]);
  return {schemaVersion:1,task:task.id,questionBudget:limits[task.risk],rounds:Array.from({length:Math.ceil(questions.length/3)},(_,i) => questions.slice(i*3,i*3+3)),renderer:'Use the active host structured question tool if exposed; otherwise ask in the parent conversation. Optional answers may be deferred; silence never supplies approval.'};
}
export function applyTask(plan,options) {
  const taskOperation=plan.operations.find(op => op.path.endsWith('/task.json'));
  assert(taskOperation?.data,'TASK_PLAN','Expected a task record operation.');
  const task=validateTask(JSON.parse(taskOperation.data.toString('utf8')));
  const checkContext=root => assert(contextSnapshot(root,task.scope).digest === plan.metadata.verification.contextDigest,'TASK_CONTEXT_CHANGED','Task inputs changed after preview. Generate a fresh task plan.',7);
  checkContext(plan.target);
  return applyPlan(plan,{...options,validate:checkContext});
}
