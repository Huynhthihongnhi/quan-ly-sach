import fs from 'node:fs';
import {assert, compareVersion, digest, fileHash, json, projectRoot, readJson, safePath, satisfies, sha256, uniquePaths} from './common.mjs';
import {catalogInfo, readCatalog, resolveSkills, skillFiles, PROVIDERS} from './catalog.mjs';
import {applyPlan, makePlan} from './transaction.mjs';

export const STATE = '.vibekit/skill.lock.json';
export function readState(target) {
  const root = projectRoot(target);
  const state = readJson(safePath(root,STATE), {schemaVersion:1,skills:{}});
  assert(state.schemaVersion === 1 && state.skills && !Array.isArray(state.skills) && typeof state.skills === 'object', 'STATE_SCHEMA', 'Unsupported skill state; preserve it and migrate before writing.', 4);
  const paths = [];
  for (const [id, record] of Object.entries(state.skills)) {
    assert(/^[a-z][a-z0-9-]*$/.test(id) && record.id === id && Array.isArray(record.files) && Array.isArray(record.providers) && Array.isArray(record.dependencies), 'STATE_SCHEMA', 'Invalid installed skill record.', 4);
    for (const file of record.files) {
      assert(typeof file.path === 'string' && /^\.(?:vibekit|claude|cursor|agents|grok|kimi-code|github)\/skills\//.test(file.path) && file.path.split('/')[2] === id && /^[a-f0-9]{64}$/.test(file.sha256) && ['managed','adopted'].includes(file.ownership), 'STATE_PATH', 'Unsafe ownership record.', 4);
      safePath(root,file.path); paths.push(file.path);
    }
  }
  uniquePaths(paths); return state;
}
export function detectRepository(target, catalog) {
  const root = projectRoot(target);
  const observed = name => fs.existsSync(safePath(root,name));
  const providers = PROVIDERS.filter(p => catalog.surfaces[p] && observed(catalog.surfaces[p].split('/')[0]));
  const kitMarkers = ['backbone.yml','.vibekit/skills/skills-manifest.json',STATE].filter(observed);
  const instructionFiles = ['AGENTS.md','CLAUDE.md','.github/copilot-instructions.md'].filter(observed);
  return {schemaVersion:1,kind:kitMarkers.length ? 'mvck' : instructionFiles.length || providers.length ? 'existing-instructions' : 'plain',providers,kitMarkers,instructionFiles,otherKit:'unconfirmed'};
}
function selectedProviders(requested, detected, catalog, installed = []) {
  const values = !requested || requested === 'auto' ? installed.length ? installed : detected.providers : requested.split(',');
  assert(values.every(p => PROVIDERS.includes(p) && catalog.surfaces[p]), 'PROVIDER_UNSUPPORTED', 'Unknown provider. Use provider detect to see supported projections.', 4);
  return [...new Set(values)].sort();
}
export function planSkill(kitRoot, target, action, id, options = {}) {
  assert(['add','update','remove','sync'].includes(action), 'INVALID_ACTION', 'Unknown skill operation.');
  const root = projectRoot(target), catalog = readCatalog(kitRoot), state = readState(root), detected = detectRepository(root,catalog);
  const beforeState = digest(state), next = structuredClone(state), changes = [], conflicts = [], warnings = [];
  if (action === 'sync') assert(!id, 'INVALID_ARGUMENT', 'skill sync does not accept a skill ID.');
  else assert(typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id), 'INVALID_ID', 'A skill ID is required.');
  assert(!options.channel || options.channel === 'stable', 'CHANNEL_UNAVAILABLE', 'This bundled catalog contains only stable artifacts.', 4);
  const requestedIds = action === 'sync' ? Object.keys(state.skills).filter(key => state.skills[key].requested && state.skills[key].source === 'bundled') : [id];
  if (action === 'sync' && Object.values(state.skills).some(skill => skill.source === 'signed-offline')) warnings.push('Signed artifacts are preserved. Use artifact add with a newly verified signed release to update them.');
  if (action === 'remove') {
    assert(state.skills[id], 'NOT_INSTALLED', `Skill is not managed: ${id}`, 4);
    const dependents = Object.values(state.skills).filter(s => s.id !== id && s.dependencies.some(d => d.id === id)).map(s => s.id);
    assert(!dependents.length, 'DEPENDENCY_IN_USE', `Required by: ${dependents.join(', ')}`, 4);
    for (const file of state.skills[id].files) {
      const actual = fileHash(root,file.path);
      if (file.ownership === 'adopted') { warnings.push(`Preserved adopted file: ${file.path}`); continue; }
      if (actual !== null && actual !== file.sha256) { conflicts.push({path:file.path,reason:'user-modified',resolution:'Preserve edits or restore the managed version before removal.'}); continue; }
      if (actual !== null) changes.push({path:file.path,data:null,reason:`Archive owned ${id} file`});
    }
    delete next.skills[id];
    warnings.push('Shared dependencies and task records are retained. Unchanged owned files are archived in the transaction receipt.');
  } else {
    const skills = [...new Map(requestedIds.flatMap(key => resolveSkills(catalog,key)).map(s => [s.id,s])).values()];
    for (const skill of skills) {
      assert(skill.access.tier === 'community', 'ENTITLEMENT_REQUIRED', 'Premium artifacts require the signed delivery interface; bundled public installation cannot bypass entitlement.', 5);
      assert(satisfies(catalog.kitVersion,skill.compatibility.kit) && satisfies(process.versions.node,skill.compatibility.node), 'COMPATIBILITY', `Unsupported kit or Node version for ${skill.id}.`, 4);
      if (options.version && skill.id === id) assert(satisfies(skill.version, options.version), 'VERSION_UNAVAILABLE', 'Requested version is not in this immutable bundled catalog.', 4);
      for (const conflict of skill.conflicts) if (next.skills[conflict] || skills.some(s => s.id === conflict)) conflicts.push({skill:skill.id,reason:`Conflicts with ${conflict}`});
      const installed = state.skills[skill.id];
      const sourceDigest = catalogInfo(kitRoot,catalog,skill.id).digest;
      if (installed) {
        assert(installed.source === 'bundled', 'ARTIFACT_COLLISION', 'A signed or foreign skill already owns this ID.', 3);
        assert(compareVersion(skill.version,installed.version) >= 0, 'SKILL_DOWNGRADE', 'Downgrades require transaction rollback.', 4);
        assert(skill.version !== installed.version || sourceDigest === installed.sourceDigest, 'SKILL_MUTABLE_RELEASE', 'Bundled skill bytes or metadata changed without a version change.', 4);
      }
      if (action === 'update' && skill.id === id) assert(installed, 'NOT_INSTALLED', `Skill is not managed: ${id}`, 4);
      const providers = selectedProviders(options.provider,detected,catalog,installed?.providers);
      assert(providers.every(p => skill.surfaces.includes(p)), 'PROVIDER_UNSUPPORTED', `Requested provider is not supported by ${skill.id}.`, 4);
      const roots = [...new Set([`.vibekit/skills/${skill.id}`, ...providers.map(p => `${catalog.surfaces[p]}/${skill.id}`)])];
      const files = skillFiles(kitRoot,skill), owned = [];
      for (const prefix of roots) for (const file of files) {
        const rel = `${prefix}/${file.path}`, existing = installed?.files.find(f => f.path === rel), current = fileHash(root,rel);
        let ownership = existing?.ownership || 'managed';
        if (existing && current !== existing.sha256) {
          conflicts.push({path:rel,reason:current === null ? 'managed-file-missing' : 'user-modified',resolution:'Restore the file or review your edits before update.'});
        } else if (!existing && current !== null) {
          if (options.adopt && current === file.sha256) ownership = 'adopted';
          else conflicts.push({path:rel,reason:'unowned',resolution:current === file.sha256 ? 'Use --adopt after reviewing identical files. Adopted files survive removal.' : 'Preserve the existing file; choose a different provider or resolve the conflict.'});
        }
        if (ownership === 'adopted' && current !== file.sha256) conflicts.push({path:rel,reason:'adopted-file-update',resolution:'Adopted files are preserved; update them manually before synchronization.'});
        changes.push({path:rel,data:file.data,ownership,reason:`${skill.id}@${skill.version}`});
        owned.push({path:rel,sha256:file.sha256,ownership});
      }
      for (const old of installed?.files || []) if (!owned.some(f => f.path === old.path)) {
        if (old.ownership === 'adopted') { warnings.push(`Preserved adopted file: ${old.path}`); continue; }
        if (fileHash(root,old.path) !== old.sha256) conflicts.push({path:old.path,reason:'user-modified'});
        else changes.push({path:old.path,data:null,reason:'Archive obsolete owned projection'});
      }
      next.skills[skill.id] = {id:skill.id,version:skill.version,channel:'stable',source:'bundled',sourceDigest,license:skill.license,providers,dependencies:skill.dependencies,requested:requestedIds.includes(skill.id) || installed?.requested === true,files:owned};
    }
  }
  if (digest(next) !== beforeState) changes.push({path:STATE,data:json(next),reason:'Record resolved versions, ownership and exact hashes'});
  const ignoreFile = safePath(root,'.gitignore'), ignore = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile,'utf8') : '';
  if (changes.some(c => fileHash(root,c.path) !== (c.data === null ? null : sha256(c.data))) && !ignore.split(/\r?\n/).some(line => ['.vibekit/local/','/.vibekit/local/'].includes(line))) {
    changes.push({path:'.gitignore',data:`${ignore}${ignore && !ignore.endsWith('\n') ? '\n' : ''}\n# MVCK local transaction receipts and backups\n/.vibekit/local/\n`,ownership:'managed-block',reason:'Keep local pre-images and receipts out of Git'});
  }
  if (!selectedProviders(options.provider,detected,catalog,state.skills[id]?.providers).length) warnings.push('No provider selected: canonical skill only. Choose --provider explicitly to add projections.');
  const plan = makePlan(root,`skill ${action}`,changes,{skill:id || null,requestedIds,repository:detected,catalogDigest:digest(catalog),stateDigest:beforeState,conflicts,warnings});
  return plan;
}
export function doctorSkill(target, id) {
  const root = projectRoot(target), state = readState(root);
  if (id) assert(state.skills[id], 'NOT_INSTALLED', `Skill is not managed: ${id}`, 4);
  const issues = [];
  for (const skill of Object.values(state.skills).filter(s => !id || s.id === id)) {
    for (const file of skill.files) { const actual = fileHash(root,file.path); if (actual !== file.sha256) issues.push({skill:skill.id,path:file.path,status:actual === null ? 'missing' : 'modified'}); }
    for (const dependency of skill.dependencies) if (!state.skills[dependency.id] || !satisfies(state.skills[dependency.id].version,dependency.range)) issues.push({skill:skill.id,dependency:dependency.id,status:'incompatible'});
  }
  return {schemaVersion:1,status:issues.length ? 'failed' : 'passed',skills:Object.keys(state.skills).length,issues,network:'not-requested',providerRuntime:'not-probed'};
}
export function applySkill(plan, options) {
  assert(!plan.metadata.conflicts.length,'FILE_CONFLICT','Resolve the listed conflicts and preview again before applying.',3);
  return applyPlan(plan,{...options,validate:root => assert(doctorSkill(root).status === 'passed','SKILL_VALIDATION','Installed skill validation failed.',10)});
}
