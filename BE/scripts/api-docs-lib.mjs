import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const sections = [
  'API Endpoint',
  'Request',
  'Response',
  'Validation và quy tắc nghiệp vụ',
  'Lỗi thường gặp',
  'Nguồn kiểm chứng',
];

export function readTree(directory, extension) {
  if (!fs.existsSync(directory)) return new Map();
  const files = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const pair of readTree(filename, extension)) files.set(...pair);
    } else if (entry.isFile() && filename.endsWith(extension)) {
      files.set(filename, fs.readFileSync(filename, 'utf8'));
    }
  }
  return files;
}

export function decorators(node) {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [])
    .map((item) => item.expression)
    .filter(ts.isCallExpression);
}

function literal(node, fallback = '') {
  if (!node) return fallback;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  throw new Error('API documentation discovery requires literal route paths. Extend the checker for this decorator.');
}

export function discoverRoutes(sources) {
  const routes = [];
  const verbs = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All']);
  for (const [filename, source] of sources) {
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    for (const declaration of ast.statements.filter(ts.isClassDeclaration)) {
      const controller = decorators(declaration).find((d) => d.expression.getText(ast) === 'Controller');
      if (!controller) continue;
      const prefix = literal(controller.arguments[0]);
      const moduleMatch = filename.replaceAll('\\', '/').match(/\/modules\/([^/]+)\//);
      if (!moduleMatch) throw new Error(`Controller outside src/modules: ${filename}`);
      for (const member of declaration.members.filter(ts.isMethodDeclaration)) {
        for (const decorator of decorators(member)) {
          const verb = decorator.expression.getText(ast);
          if (!verbs.has(verb)) continue;
          const localPath = '/' + [prefix, literal(decorator.arguments[0])].filter(Boolean).join('/');
          const fullPath = /^\/health\/(live|ready)$/.test(localPath) && verb === 'Get'
            ? localPath : '/api/v1' + (localPath === '/' ? '' : localPath);
          const method = verb.toUpperCase();
          const module = moduleMatch[1];
          routes.push({
            method, path: fullPath, module,
            controller: declaration.name.text,
            handler: member.name.getText(ast),
            source: filename, node: member, ast,
            document: `${module}/${method.toLowerCase()}-${localPath.slice(1).replaceAll(':', '').replaceAll('/', '-') || 'root'}.md`,
          });
        }
      }
    }
  }
  return routes.sort((a, b) => `${a.module} ${a.path} ${a.method}`.localeCompare(`${b.module} ${b.path} ${b.method}`));
}

export function checkCoverage(routes, documents) {
  const errors = [];
  const documented = new Map();
  for (const [filename, content] of documents) {
    const markers = [...content.matchAll(/<!-- api-doc: (.+?) -->/g)];
    if (!markers.length) {
      if (/^(get|post|put|patch|delete|head|options|all)-/.test(path.basename(filename))) {
        errors.push(`${filename}: missing api-doc metadata`);
      }
      continue;
    }
    if (markers.length !== 1) errors.push(`${filename}: expected one endpoint per file`);
    let metadata;
    try { metadata = JSON.parse(markers[0][1]); } catch {
      errors.push(`${filename}: invalid api-doc JSON`);
      continue;
    }
    const key = `${metadata.method} ${metadata.path}`;
    if (documented.has(key)) errors.push(`${filename}: duplicate ${key}`);
    documented.set(key, { filename, metadata });
    for (const section of sections) {
      const heading = `## ${section}\n`;
      const start = content.indexOf(heading);
      const body = start < 0 ? '' : content.slice(start + heading.length).split('\n## ')[0].trim();
      if (!body || /^(TODO|TBD|\.\.\.)$/.test(body)) errors.push(`${filename}: missing content for ${section}`);
    }
    if (!content.includes(`| \`${metadata.method}\` | \`${metadata.path}\` |`)) {
      errors.push(`${filename}: endpoint table does not match metadata`);
    }
    if (!/\]\([^)]*test\/[^)]+\.spec\.ts\)/.test(content)) {
      errors.push(`${filename}: missing test source link`);
    }
    for (const match of content.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
      try { JSON.parse(match[1]); } catch { errors.push(`${filename}: invalid JSON example`); }
    }
  }
  const current = new Set();
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (current.has(key)) errors.push(`Duplicate controller route: ${key}`);
    current.add(key);
    const doc = documented.get(key);
    if (!doc) { errors.push(`Missing documentation: ${key} -> ${route.document}`); continue; }
    if (doc.filename !== route.document) errors.push(`${doc.filename}: expected ${route.document}`);
    if (doc.metadata.controller !== route.controller || doc.metadata.handler !== route.handler) {
      errors.push(`${doc.filename}: controller/handler changed; review documentation`);
    }
    const index = documents.get(`${route.module}/README.md`);
    if (!index?.includes(`](${path.basename(route.document)})`)) {
      errors.push(`${route.module}/README.md: missing link to ${route.document}`);
    }
  }
  for (const [key, doc] of documented) {
    if (!current.has(key)) errors.push(`${doc.filename}: stale endpoint ${key}`);
  }
  return errors;
}

export function checkLinks(documents, docsRoot) {
  const errors = [];
  for (const [filename, content] of documents) {
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      const resolved = path.resolve(docsRoot, path.dirname(filename), decodeURIComponent(target));
      if (!fs.existsSync(resolved)) errors.push(`${filename}: broken link ${target}`);
    }
  }
  return errors;
}
