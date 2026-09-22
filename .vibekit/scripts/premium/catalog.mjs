import fs from 'node:fs';
import path from 'node:path';
import {assert, digest, fileList, projectRoot, readJson, relativePath, safePath, semver, sha256, satisfies, uniquePaths} from './common.mjs';

export const PROVIDERS = ['claude','cursor','codex','opencode','grok','kimi','copilot'];
export const CAPABILITIES = ['repo.read','repo.write.scoped','shell.validate','user.interview','web.official-docs','git.read','git.worktree','task.evidence'];
function shape(value, allowed, required=allowed) {
  assert(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value,key)), 'MANIFEST_FIELDS', 'Unknown or missing source catalog field.', 4);
}
export function readCatalog(kitRoot) {
  const raw = readJson(path.join(kitRoot, '.vibekit/skills/skills-manifest.json'));
  const pkg = readJson(path.join(kitRoot, 'package.json'), {version:'0.6.0'});
  assert([2,3].includes(raw.version) && Array.isArray(raw.skills), 'MANIFEST_VERSION', 'Expected manifest version 2 or 3.', 4);
  if (raw.version === 3) {
    shape(raw,['version','kitVersion','description','surfaces','skills'],['version','kitVersion','surfaces','skills']);
    semver(raw.kitVersion);
    for (const entry of raw.skills) {
      shape(entry,['name','version','description','license','access','compatibility','dependencies','conflicts','capabilities','surfaces']);
      shape(entry.access,['tier','feature'],['tier']); shape(entry.compatibility,['kit','node']);
      assert(Array.isArray(entry.dependencies),'MANIFEST_DEPENDENCIES','Dependencies must be an array.');
      for (const dependency of entry.dependencies) shape(dependency,['id','range']);
    }
  }
  const skills = raw.skills.map(entry => ({id:entry.name, version:entry.version || '1.0.0', description:entry.description || entry.name, license:entry.license || 'MIT', access:entry.access || {tier:'community'}, compatibility:entry.compatibility || {kit:'>=0.5.15 <2.0.0',node:'>=18.0.0'}, dependencies:entry.dependencies || [], conflicts:entry.conflicts || [], capabilities:entry.capabilities || ['repo.read'], entrypoint:'SKILL.md', surfaces:entry.surfaces, ...entry}));
  const catalog = {schemaVersion:3, migratedFrom:raw.version, kitVersion:raw.kitVersion || pkg.version, surfaces:raw.surfaces, skills};
  validateCatalog(catalog);
  return catalog;
}
export function validateCatalog(catalog) {
  assert(catalog.schemaVersion === 3 && Array.isArray(catalog.skills), 'MANIFEST_VERSION', 'Expected catalog schemaVersion 3.', 4);
  const ids = new Set();
  for (const [provider, root] of Object.entries(catalog.surfaces || {})) {
    const expected={claude:'.claude/skills',cursor:'.cursor/skills',codex:'.agents/skills',opencode:'.agents/skills',grok:'.grok/skills',kimi:'.kimi-code/skills',copilot:'.github/skills'};
    assert(PROVIDERS.includes(provider) && relativePath(root) === expected[provider], 'MANIFEST_SURFACE', 'Invalid provider surface.');
  }
  for (const skill of catalog.skills) {
    assert(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(skill.id) && !ids.has(skill.id), 'MANIFEST_ID', 'Invalid or duplicate skill ID.');
    ids.add(skill.id); semver(skill.version);
    assert(typeof skill.description === 'string' && typeof skill.license === 'string', 'MANIFEST_FIELDS', 'Description and license are required.');
    assert(['community','premium'].includes(skill.access?.tier) && (skill.access.tier !== 'premium' || typeof skill.access.feature === 'string'), 'MANIFEST_ACCESS', 'Invalid access policy.');
    assert(Array.isArray(skill.surfaces) && skill.surfaces.length && new Set(skill.surfaces).size === skill.surfaces.length && skill.surfaces.every(p => catalog.surfaces[p]), 'MANIFEST_SURFACE', 'Unknown or repeated surface.');
    assert(Array.isArray(skill.capabilities) && skill.capabilities.every(c => CAPABILITIES.includes(c)), 'MANIFEST_CAPABILITY', 'Unknown required capability.', 4);
    assert(Array.isArray(skill.dependencies) && Array.isArray(skill.conflicts) && skill.conflicts.every(id => /^[a-z][a-z0-9-]*$/.test(id) && id !== skill.id), 'MANIFEST_DEPENDENCIES', 'Dependencies and conflicts must be valid arrays.');
    assert(!skill.hooks?.length && !skill.migrations?.length, 'EXECUTABLE_MANIFEST', 'Lifecycle hooks and executable migrations are unsupported.');
    relativePath(skill.entrypoint);
    for (const range of [skill.compatibility?.kit, skill.compatibility?.node]) satisfies('0.0.0', range);
    if (skill.files) { uniquePaths(skill.files.map(f => f.path)); for (const file of skill.files) assert(/^[a-f0-9]{64}$/.test(file.sha256), 'MANIFEST_DIGEST', 'Invalid file digest.'); }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    assert(ids.has(id), 'MISSING_DEPENDENCY', `Missing dependency: ${id}`, 4);
    assert(!visiting.has(id), 'DEPENDENCY_CYCLE', `Dependency cycle at ${id}`, 4);
    if (visited.has(id)) return;
    visiting.add(id);
    const skill = catalog.skills.find(s => s.id === id);
    for (const dep of skill.dependencies) {
      assert(dep && typeof dep.id === 'string', 'MANIFEST_DEPENDENCY', 'Dependencies require id and range.');
      visit(dep.id);
      assert(satisfies(catalog.skills.find(s => s.id === dep.id).version, dep.range), 'DEPENDENCY_VERSION', `Incompatible dependency: ${dep.id}`, 4);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids) visit(id);
  return catalog;
}
export function resolveSkills(catalog, id) {
  const result = [], seen = new Set();
  function visit(name) {
    const skill = catalog.skills.find(s => s.id === name);
    assert(skill, 'SKILL_NOT_FOUND', `Unknown skill: ${name}`, 4);
    if (seen.has(name)) return;
    seen.add(name);
    skill.dependencies.forEach(dep => visit(dep.id)); result.push(skill);
  }
  visit(id); return result;
}
export function skillFiles(kitRoot, skill) {
  kitRoot = projectRoot(kitRoot);
  const prefix = `.vibekit/skills/${skill.id}`;
  const files = fileList(kitRoot, prefix).map(full => {
    const data = fs.readFileSync(safePath(kitRoot, full));
    assert(data.length <= 2 * 1024 * 1024, 'FILE_TOO_LARGE', 'Skill file exceeds 2 MiB.');
    return {path:full.slice(prefix.length + 1), sha256:sha256(data), size:data.length, data};
  });
  uniquePaths(files.map(f => f.path));
  assert(files.some(f => f.path === skill.entrypoint), 'MISSING_ENTRYPOINT', `Missing ${skill.id} entrypoint.`);
  return files;
}
export function catalogInfo(kitRoot, catalog, id) {
  const skill = catalog.skills.find(s => s.id === id);
  assert(skill, 'SKILL_NOT_FOUND', `Unknown skill: ${id}`, 4);
  const files = skillFiles(kitRoot, skill).map(({data, ...file}) => file);
  return {...skill, files, digest:digest({skill,files}), source:'bundled', channel:'stable', healthChecks:['structure','hashes','provider-projections']};
}
