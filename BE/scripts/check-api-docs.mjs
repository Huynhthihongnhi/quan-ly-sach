import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCoverage, checkLinks, discoverRoutes, readTree } from './api-docs-lib.mjs';

// Read source only. Do not boot Nest, connect to MySQL, or execute controller code.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(backendRoot, 'docs/DOC-API');
try {
  const routes = discoverRoutes(readTree(path.join(backendRoot, 'src'), '.ts'));
  if (!routes.length) throw new Error('No controller routes found; refusing an empty coverage pass.');
  const documents = new Map([...readTree(docsRoot, '.md')].map(([filename, content]) => [
    path.relative(docsRoot, filename).split(path.sep).join('/'), content,
  ]));
  const errors = [...checkCoverage(routes, documents), ...checkLinks(documents, docsRoot)];
  for (const module of new Set(routes.map((route) => route.module))) {
    if (!documents.get('README.md')?.includes(`](${module}/README.md)`)) {
      errors.push(`README.md: missing module ${module}`);
    }
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`API docs: ${routes.length}/${routes.length} endpoints, ${new Set(routes.map((r) => r.module)).size} modules; coverage, JSON examples and local links passed.`);
  }
} catch (error) {
  console.error(`API docs check failed: ${error.message}`);
  process.exitCode = 1;
}
