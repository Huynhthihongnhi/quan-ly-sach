import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class KitError extends Error {
  constructor(code, message, exitCode = 2) { super(message); this.code = code; this.exitCode = exitCode; }
}
export function assert(condition, code, message, exitCode = 2) {
  if (!condition) throw new KitError(code, message, exitCode);
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') { assert(Number.isSafeInteger(value), 'INVALID_JSON', 'Only safe integers are supported.'); return String(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_JSON', 'Expected a JSON object.');
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export const digest = value => sha256(canonical(value));
export const json = value => `${JSON.stringify(value, null, 2)}\n`;
export function readJson(file, fallback) {
  if (!fs.existsSync(file) && fallback !== undefined) return fallback;
  assert(fs.statSync(file).size <= 16 * 1024 * 1024, 'FILE_TOO_LARGE', 'JSON input exceeds 16 MiB.');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new KitError('INVALID_JSON', `Invalid JSON in ${path.basename(file)}.`); }
}
export function relativePath(value) {
  assert(typeof value === 'string' && value.length > 0 && value.length < 1024 && value === value.normalize('NFC'), 'UNSAFE_PATH', 'Expected a normalized relative path.');
  assert(!/[\\\x00-\x1f\x7f:*?"<>|]/.test(value) && !path.isAbsolute(value), 'UNSAFE_PATH', 'Absolute paths, control characters and alternate separators are prohibited.');
  const parts = value.split('/');
  assert(parts.every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)), 'UNSAFE_PATH', 'Unsafe path segment.');
  return value;
}
export function projectRoot(input) {
  assert(typeof input === 'string' && input.trim().length > 0 && !/[\x00-\x1f]/.test(input), 'UNSAFE_ROOT', 'A non-empty project directory is required.');
  const root = path.resolve(input);
  assert(fs.existsSync(root) && fs.lstatSync(root).isDirectory(), 'UNSAFE_ROOT', 'Target must be an existing, non-symlink directory.');
  const real = fs.realpathSync(root);
  const broad = [path.parse(real).root, os.homedir(), '/Users', '/home', '/private', '/tmp', '/private/tmp', '/var', '/etc', '/usr', '/opt'];
  assert(!broad.includes(real), 'UNSAFE_ROOT', 'Choose a project directory, not a home or system directory.');
  return real;
}
export function safePath(root, rel) {
  relativePath(rel);
  assert(fs.lstatSync(root).isDirectory() && !fs.lstatSync(root).isSymbolicLink(), 'ROOT_CHANGED', 'Project root changed after discovery.', 7);
  const base = fs.realpathSync(root);
  assert(base === path.resolve(root), 'ROOT_CHANGED', 'Use the canonical project root.', 7);
  let cursor = base;
  for (const part of rel.split('/')) {
    if (fs.existsSync(cursor) && fs.statSync(cursor).isDirectory()) {
      assert(!fs.readdirSync(cursor).some(name => name !== part && name.normalize('NFC').toLowerCase() === part.toLowerCase()), 'PATH_COLLISION', `Case or Unicode collision: ${rel}`, 7);
    }
    cursor = path.join(cursor, part);
    let stat;
    try { stat = fs.lstatSync(cursor); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert(!stat?.isSymbolicLink(), 'SYMLINK_PATH', `Symlink refused: ${rel}`, 7);
    assert(!stat || stat.isDirectory() || (cursor === path.join(base, rel) && stat.isFile() && stat.nlink === 1), 'SPECIAL_PATH', `Special file or hardlink refused: ${rel}`, 7);
  }
  return cursor;
}
export function fileHash(root, rel) {
  const file = safePath(root, rel);
  if (!fs.existsSync(file)) return null;
  assert(fs.statSync(file).isFile(), 'PATH_COLLISION', `Expected a file: ${rel}`, 7);
  return sha256(fs.readFileSync(file));
}
export function fileList(root, dir) {
  const found = [];
  function visit(rel) {
    const file = safePath(root, rel);
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(`${rel}/${name}`);
    else { assert(stat.isFile(), 'SPECIAL_PATH', 'Only regular files may be distributed.'); found.push(rel); }
  }
  visit(dir);
  return found;
}
export function uniquePaths(paths) {
  const folded = paths.map(p => relativePath(p).toLowerCase());
  assert(new Set(folded).size === paths.length, 'PATH_COLLISION', 'Duplicate or case-insensitive destination collision.');
  const sorted = [...folded].sort();
  assert(!sorted.some((p, i) => i && p.startsWith(`${sorted[i - 1]}/`)), 'PATH_COLLISION', 'A file cannot also be a parent directory.');
}
export function semver(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(version || '');
  assert(match, 'INVALID_VERSION', `Invalid version: ${String(version)}`);
  assert(!match[4] || match[4].split('.').every(part => part && (!/^\d+$/.test(part) || part === '0' || !part.startsWith('0'))), 'INVALID_VERSION', 'Invalid prerelease identifier.');
  assert(match.slice(1,4).every(part => Number.isSafeInteger(Number(part))), 'INVALID_VERSION', 'Version component exceeds safe integer range.');
  return {parts: match.slice(1, 4).map(Number), prerelease: match[4] || ''};
}
export function compareVersion(a, b) {
  const av = semver(a), bv = semver(b);
  for (let i = 0; i < 3; i++) if (av.parts[i] !== bv.parts[i]) return Math.sign(av.parts[i] - bv.parts[i]);
  if (av.prerelease === bv.prerelease) return 0;
  if (!av.prerelease) return 1;
  if (!bv.prerelease) return -1;
  const ap = av.prerelease.split('.'), bp = bv.prerelease.split('.');
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if (ap[i] === undefined) return -1;
    if (bp[i] === undefined) return 1;
    if (ap[i] === bp[i]) continue;
    const an = /^\d+$/.test(ap[i]), bn = /^\d+$/.test(bp[i]);
    if (an && bn) return ap[i].length !== bp[i].length ? Math.sign(ap[i].length - bp[i].length) : ap[i] < bp[i] ? -1 : 1;
    if (an !== bn) return an ? -1 : 1;
    return ap[i] < bp[i] ? -1 : 1;
  }
  return 0;
}
export function satisfies(version, range) {
  semver(version);
  assert(typeof range === 'string' && range.trim(), 'INVALID_RANGE', 'A version range is required.');
  // Parse every branch before comparison, including branches that cannot match.
  const branches = range.trim().split(/\s*\|\|\s*/).map(branch => branch.trim().split(/\s+/).map(clause => {
    if (clause === '*') return {wildcard:true};
    const match = /^(>=|<=|>|<|=|\^|~)?(.+)$/.exec(clause);
    assert(match, 'INVALID_RANGE', 'Empty or unsupported version range.');
    const [, op = '=', rawBase] = match;
    const partial = /^(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.exec(rawBase);
    const base = partial ? `${partial[1]}.${partial[2] || '0'}.0` : rawBase;
    semver(base); return {op,partial,base};
  }));
  return branches.some(clauses => {
    if (semver(version).prerelease && !clauses.some(c => c.base?.includes('-') && c.base.split('-')[0] === version.split('-')[0])) return false;
    return clauses.every(({op,partial,base,wildcard}) => {
      if (wildcard) return !semver(version).prerelease;
      const parsed = semver(base), cmp = compareVersion(version, base);
      if (partial && ['=','>','<='].includes(op)) {
        const upper = partial[2] === undefined ? `${Number(partial[1])+1}.0.0` : `${partial[1]}.${Number(partial[2])+1}.0`;
        const upperCmp = compareVersion(version,upper);
        return op === '>' ? upperCmp >= 0 : op === '<=' ? upperCmp < 0 : cmp >= 0 && upperCmp < 0;
      }
      if (op === '^' || op === '~') {
        const [major, minor, patch] = parsed.parts;
        const upper = partial && partial[2] === undefined ? `${major+1}.0.0` : op === '~' ? `${major}.${minor + 1}.0` : major ? `${major + 1}.0.0` : minor || partial ? `0.${minor + 1}.0` : `0.0.${patch + 1}`;
        return cmp >= 0 && compareVersion(version, upper) < 0;
      }
      return { '=':cmp === 0, '>':cmp > 0, '<':cmp < 0, '>=':cmp >= 0, '<=':cmp <= 0 }[op];
    });
  });
}
export function redact(value) {
  return String(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g, '[redacted-private-key]').replace(/MVCK-[A-Za-z0-9_-]{12,}/g, '[redacted-license]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[redacted-credential]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]').replaceAll(os.homedir(), '~');
}
