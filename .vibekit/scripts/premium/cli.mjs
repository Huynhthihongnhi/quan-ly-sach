import fs from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {assert,json,readJson,redact} from './common.mjs';
import {catalogInfo,readCatalog} from './catalog.mjs';
import {applySkill,doctorSkill,planSkill,readState} from './skills.mjs';
import {publicPlan,rollbackTransaction,transactionStatus} from './transaction.mjs';
import {applyTask,interview,loadTask,planTask,renderTask,verifyTask} from './tasks.mjs';
import {compileProvider,providerDetect,POLICY,classifyCommand} from './providers.mjs';
import {applyWorktree,historyReport,inspectGit,planWorktree,prPreview} from './git-workflow.mjs';
import {verifyPremiumDelivery} from './artifacts.mjs';
import {licensingStatus} from './entitlements.mjs';
import {planDelivery} from './delivery.mjs';
import {measureQuality,qualityReport} from './quality.mjs';

export const NAMESPACES=['skill','transaction','task','provider','capabilities','policy','worktree','history','pr','artifact','license','privacy','quality'];
export const COMMANDS=[
  ['skill list|search|info|doctor [id]','Read the bundled catalog and installed file health.'],
  ['skill add|plan|update|remove <id>','Preview one skill lifecycle transaction.'],
  ['skill sync','Preview synchronization of explicitly installed bundled skills.'],
  ['transaction status|recover|rollback [id]','Inspect receipts or preview restoration of pre-images.'],
  ['task start <id> --input brief.json','Preview a target contract and readable task record.'],
  ['task status|interview|tickets|verify|report <id>','Inspect scope, questions, tickets and evidence.'],
  ['task record <id> --input evidence.json','Preview updated evidence, claims or tickets.'],
  ['task revise <id> --input revision.json','Revise the target contract and invalidate prior evidence.'],
  ['task advance <id> --phase explore|execute|verify|blocked','Preview the next task phase.'],
  ['task refresh-context|finish <id>','Invalidate stale evidence or close a verified task.'],
  ['provider detect','Inspect provider files without running provider binaries.'],
  ['provider plan <provider> [--version <version>] [--input request.json]','Return a provider policy fragment for review.'],
  ['capabilities','Show local capabilities and commercial release gates.'],
  ['policy show|classify [--command <text>]','Inspect neutral policy or advisory command classification.'],
  ['worktree inspect|create|remove [--branch feat/name]','Inspect or preview a sibling worktree operation.'],
  ['history <path> [--limit 8]','Collect bounded, redacted local Git history.'],
  ['pr preview --input pr.json','Render a local PR payload without calling GitHub.'],
  ['artifact verify|add --input delivery.json','Verify a signed offline package or preview installation.'],
  ['license status','Show entitlement service readiness without network access.'],
  ['quality measure --input scope.json --analyzer-root <directory>','Measure explicit JS files with a separately installed, pinned ESLint.'],
  ['quality report --input snapshot.json [--baseline before.json]','Check source hashes and report complexity, erosion and optional verbosity.'],
  ['privacy show','Show the no-telemetry and credential-storage contract.']
];
export function premiumHelp() {
  return ['MVCK Premium local capabilities','',...COMMANDS.map(([usage,description]) => `  mvck ${usage}\n    ${description}`),'','Common flags: --target <existing-directory> --json --dry-run','Mutation: --apply --accept-plan-sha256 <digest>','Without a supplied digest, an interactive --apply asks you to approve the displayed plan.','Non-interactive mutation requires the digest. Preview writes nothing.','Provider fragments are proposals only. Live licensing and publication require release setup.',''].join('\n');
}
function parse(args) {
  const values=new Set(['target','provider','version','to','channel','accept-plan-sha256','input','brief','phase','branch','limit','command','baseline','analyzer-root']);
  const booleans=new Set(['json','apply','dry-run','non-interactive','adopt','installed','available','check','help']);
  const flags={}, positional=[];
  for (let i=0;i<args.length;i++) {
    if (!args[i].startsWith('--')) { positional.push(args[i]); continue; }
    const [key,...inline]=args[i].slice(2).split('=');
    assert(values.has(key) || booleans.has(key),'UNKNOWN_FLAG',`Unknown flag: --${key}`);
    assert(!Object.hasOwn(flags,key),'DUPLICATE_FLAG',`Repeated flag: --${key}`);
    if (booleans.has(key)) { assert(!inline.length,'INVALID_FLAG',`--${key} does not take a value.`); flags[key]=true; }
    else { const value=inline.length ? inline.join('=') : args[++i]; assert(value !== undefined && !value.startsWith('--') && value.length,'MISSING_FLAG_VALUE',`--${key} requires a value.`); flags[key]=value; }
  }
  assert(!(flags.apply && (flags['dry-run'] || flags.check)),'CONFLICTING_FLAGS','Preview/check and --apply cannot be combined.');
  assert(!(flags.installed && flags.available),'CONFLICTING_FLAGS','Choose installed or available skills.');
  return {flags,positional};
}
function print(value,machine) { console.log(machine ? json(value).trimEnd() : typeof value === 'string' ? value : redact(json(value).trimEnd())); }
async function approve(plan,flags) {
  if (!flags.apply) return null;
  if (flags['accept-plan-sha256']) return flags['accept-plan-sha256'];
  assert(!flags['non-interactive'] && process.stdin.isTTY && process.stdout.isTTY && !flags.json,'PLAN_APPROVAL_REQUIRED','Use --apply --accept-plan-sha256 with the exact preview digest.',3);
  print(plan,false);
  const reader=createInterface({input:process.stdin,output:process.stdout});
  let answer; try { answer=await reader.question('Apply this exact plan? Type apply: '); } finally { reader.close(); }
  assert(answer === 'apply','PLAN_NOT_APPROVED','No changes applied.',3);
  return plan.sha256;
}
export async function runPremium(kitRoot,args) {
  const {flags,positional}=parse(args), [namespace,verb,id]=positional, target=path.resolve(flags.target || process.cwd());
  if (flags.help) { print(premiumHelp(),false); return; }
  const input=() => { const file=flags.input || flags.brief; assert(file,'INPUT_REQUIRED','Provide --input with a JSON record.'); return readJson(path.resolve(file)); };
  const allowedCount=namespace === 'history' ? 2 : 3;
  assert(positional.length <= allowedCount,'EXTRA_ARGUMENT','Unexpected positional argument. Use --target for the project path.');
  let result;
  if (namespace === 'skill') {
    const catalog=readCatalog(kitRoot);
    if (['list','search'].includes(verb)) {
      const state=readState(target);
      result={schemaVersion:1,source:'bundled',skills:catalog.skills.filter(s => (!flags.provider || s.surfaces.includes(flags.provider)) && (!flags.installed || state.skills[s.id]) && (!flags.available || !state.skills[s.id]) && (verb !== 'search' || `${s.id} ${s.description}`.toLowerCase().includes((id || '').toLowerCase()))).map(s => ({id:s.id,version:s.version,installed:state.skills[s.id]?.version || null,access:s.access.tier,license:s.license,description:s.description}))};
    } else if (verb === 'info') result=catalogInfo(kitRoot,catalog,id);
    else if (verb === 'doctor') { result=doctorSkill(target,id); if (result.status === 'failed') process.exitCode=10; }
    else {
      const action=verb === 'plan' ? 'add' : verb;
      const plan=planSkill(kitRoot,target,action,id,{provider:flags.provider,version:flags.version || flags.to,channel:flags.channel,adopt:flags.adopt});
      const acceptedDigest=await approve(publicPlan(plan),flags);
      result=acceptedDigest ? applySkill(plan,{acceptedDigest,nonInteractive:flags['non-interactive']}) : publicPlan(plan);
    }
  } else if (namespace === 'transaction') {
    if (verb === 'status') result=transactionStatus(target);
    else {
      assert(['recover','rollback'].includes(verb),'TRANSACTION_ACTION','Expected status, recover or rollback.');
      const transactionId=id || transactionStatus(target).active?.id;
      const plan=rollbackTransaction(target,transactionId);
      const acceptedDigest=await approve(plan,flags);
      result=acceptedDigest ? rollbackTransaction(target,transactionId,{apply:true,acceptedDigest}) : plan;
    }
  } else if (namespace === 'task') {
    if (['status','interview','tickets','verify','report'].includes(verb)) {
      const task=loadTask(target,id);
      if (verb === 'status') result={schemaVersion:1,id,phase:task.phase,revision:task.revision,contractDigest:task.contractDigest,contextDigest:task.context.digest,scope:task.scope,criteria:task.criteria};
      if (verb === 'interview') result=interview(task);
      if (verb === 'tickets') result={schemaVersion:1,task:id,tickets:task.tickets};
      if (verb === 'verify' || verb === 'report') { const verification=verifyTask(target,task); result=verb === 'report' ? renderTask(task,verification) : verification; if (verification.status !== 'passed') process.exitCode=3; }
    } else {
      const plan=planTask(target,id,verb,['start','record','revise'].includes(verb) ? input() : verb === 'advance' ? {phase:flags.phase} : {});
      const acceptedDigest=await approve(publicPlan(plan),flags);
      result=acceptedDigest ? applyTask(plan,{acceptedDigest,nonInteractive:flags['non-interactive']}) : publicPlan(plan);
    }
  } else if (namespace === 'provider') {
    assert(!flags.apply,'PROPOSAL_ONLY','Provider configuration is returned as a reviewable fragment.');
    if (verb === 'detect') result=providerDetect(target);
    else {
      assert(verb === 'plan','PROVIDER_ACTION','Expected detect or plan.');
      const request=flags.input ? input() : {};
      assert(Object.keys(request).every(key => ['policy','requested'].includes(key)), 'PROVIDER_INPUT', 'Provider input accepts policy and requested keys only.');
      result=compileProvider(id,{version:flags.version,...request});
    }
  } else if (namespace === 'capabilities') result={schemaVersion:1,edition:'premium',catalog:3,skillLifecycle:'transactional',tasks:'evidence-linked',providers:'proposal-only',worktrees:'explicit-plan-approval',signedDelivery:'offline-operator-trust',licensing:licensingStatus(),network:'not-requested'};
  else if (namespace === 'policy') { assert(['show','classify'].includes(verb),'POLICY_ACTION','Expected show or classify.'); result=verb === 'show' ? POLICY : classifyCommand(flags.command); }
  else if (namespace === 'worktree') {
    if (verb === 'inspect') result=inspectGit(target);
    else { const plan=planWorktree(target,verb,{branch:flags.branch}); const acceptedDigest=await approve(plan,flags); result=acceptedDigest ? applyWorktree(target,plan,{acceptedDigest}) : plan; }
  } else if (namespace === 'history') result=historyReport(target,verb,{limit:flags.limit ? Number(flags.limit) : 8});
  else if (namespace === 'pr') { assert(verb === 'preview' && !flags.apply,'PR_PREVIEW_ONLY','Use pr preview; remote creation needs separate authorization.'); result=prPreview(target,input()); }
  else if (namespace === 'artifact') {
    const record=input();
    if (verb === 'verify') { const {artifact,entitlement}=verifyPremiumDelivery(record); result={schemaVersion:1,status:'verified',manifestDigest:artifact.manifestDigest,files:artifact.files.map(({data,...f}) => f),entitlement,trust:'operator-supplied public keys; production registry is not configured'}; }
    else { assert(verb === 'add','ARTIFACT_ACTION','Expected verify or add.'); const plan=planDelivery(target,record,{provider:flags.provider}); const acceptedDigest=await approve(publicPlan(plan),flags); if (acceptedDigest) verifyPremiumDelivery(record); result=acceptedDigest ? applySkill(plan,{acceptedDigest}) : publicPlan(plan); }
  } else if (namespace === 'quality') {
    assert(!flags.apply && !id && ['measure','report'].includes(verb),'QUALITY_ACTION','Use read-only quality measure or quality report.');
    result=verb==='measure'?measureQuality(target,input(),flags['analyzer-root']):qualityReport(target,input(),flags.baseline?readJson(path.resolve(flags.baseline)):undefined);
  } else if (namespace === 'license') { assert(verb === 'status','LICENSE_NOT_CONFIGURED','Live activation is not configured. Use license status for required release setup.',5); result=licensingStatus(); }
  else if (namespace === 'privacy') { assert(verb === 'show','PRIVACY_ACTION','Expected privacy show.'); result={schemaVersion:1,telemetry:'off',network:'Only an explicitly invoked future service adapter may connect.',credentials:'Never stored by local commands. Use OS credential storage in the production service adapter.',receipts:'.vibekit/local/transactions retains pre-images; review locally and remove through an explicitly approved recovery/retention process.',tasks:'Store references, hashes and redacted observations. Do not include credentials.'}; }
  else assert(false,'UNKNOWN_COMMAND','Unknown premium command.');
  print(result,flags.json);
}
