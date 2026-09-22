import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {assert,digest,projectRoot,relativePath,safePath,sha256,uniquePaths,satisfies} from './common.mjs';

export const ESLINT_VERSION='10.10.0';
const check=(ok,message)=>assert(ok,'QUALITY_INPUT',message);
const integer=(n,min=0)=>Number.isSafeInteger(n) && n>=min && n<=10_000_000;
const label=s=>typeof s==='string' && s.trim().length>0 && s.length<=1024;
const list=a=>Array.isArray(a) && a.length<=100_000;

function scopeContract(scope) {
  check(scope && list(scope.files) && scope.files.length>0 && scope.files.length<=1000,'Select 1-1000 explicit source files.');
  check(list(scope.exclusions) && scope.exclusions.every(label),'Record exclusions as an array of reasons.');
  uniquePaths(scope.files);
  for (const file of scope.files) {
    relativePath(file);
    check(!file.split('/').some(p=>/^(?:\.git|node_modules|dist|build|coverage|\.env.*)$/i.test(p) || /secret|token/i.test(p)), 'Scope includes a generated or sensitive path.');
  }
  return {files:[...scope.files].sort(),exclusions:[...scope.exclusions].sort()};
}

function tokenLines(sourceCode,node) {
  const lines=new Set();
  for (const token of sourceCode.getTokens(node)) {
    for (let line=token.loc.start.line;line<=token.loc.end.line;line++) lines.add(line);
  }
  return lines.size;
}

function loadAnalyzer(analyzerRoot) {
  assert(label(analyzerRoot),'QUALITY_ANALYZER_REQUIRED','Select a reviewed ESLint installation with --analyzer-root. Nothing is installed automatically.');
  assert(satisfies(process.versions.node,'>=20.19.0 <21 || >=22.13.0 <23 || >=24'),'QUALITY_NODE','The optional ESLint collector requires Node 20.19+, 22.13+ or 24+. Reporting remains available on Node 18.');
  const root=projectRoot(analyzerRoot), require=createRequire(path.join(root,'package.json'));
  let api, builtins;
  try {
    const resolved=require.resolve('eslint');
    check(resolved.startsWith(`${root}${path.sep}node_modules${path.sep}`),'ESLint must be installed under the selected analyzer root.');
    api=require('eslint'); builtins=require('eslint/use-at-your-own-risk');
  } catch (error) {
    if (error.code==='QUALITY_INPUT') throw error;
    assert(false,'QUALITY_ANALYZER_REQUIRED',`Install and review eslint@${ESLINT_VERSION} in the selected analyzer root first.`);
  }
  check(api.Linter.version===ESLINT_VERSION,`This collector requires eslint@${ESLINT_VERSION}; update and validate the adapter before changing versions.`);
  return {Linter:api.Linter,complexity:builtins.builtinRules.get('complexity')};
}

function measureFile(root,file,{Linter,complexity}) {
  check(/\.(?:js|mjs|cjs)$/.test(file),'The bundled collector supports JavaScript, MJS and CJS only.');
  const resolved=safePath(root,file), stat=fs.statSync(resolved);
  check(stat.isFile() && stat.size<=2*1024*1024,'Source file exceeds 2 MiB or is not regular.');
  const bytes=fs.readFileSync(resolved), source=bytes.toString('utf8'), functions=[];
  let sloc=0;
  // Use ESLint's pinned AST/code-path implementation, not keyword counting.
  // This adapter intentionally uses its internal rule API; the exact version is checked above.
  const rule={meta:{schema:[]},create(context) {
    const listeners=complexity.create({sourceCode:context.sourceCode,options:[0],report({node,data}) {
      functions.push({name:data.name,line:node.loc.start.line,column:node.loc.start.column+1,
        endLine:node.loc.end.line,cc:data.complexity,sloc:tokenLines(context.sourceCode,node)});
    }});
    return {...listeners,Program(node) { sloc=tokenLines(context.sourceCode,node); }};
  }};
  const messages=new Linter().verify(source,[{files:['**/*.{js,mjs,cjs}'],
    languageOptions:{ecmaVersion:2024,sourceType:file.endsWith('.cjs')?'commonjs':'module'},
    linterOptions:{noInlineConfig:true,reportUnusedDisableDirectives:'off'},
    plugins:{mvck:{rules:{measure:rule}}},rules:{'mvck/measure':'error'}}],{filename:file,allowInlineConfig:false});
  check(!messages.length,`Unable to measure ${file}; parse/config diagnostics must be resolved first.`);
  const loc=source.length ? source.split(/\r\n|[\n\r\u2028\u2029]/).length-Number(/[\n\r\u2028\u2029]$/.test(source)) : 0;
  return {path:file,sha256:sha256(bytes),loc,sloc,functions:functions.sort((a,b)=>a.line-b.line || a.column-b.column || a.endLine-b.endLine)};
}

export function measureQuality(target,scope,analyzerRoot) {
  const root=projectRoot(target), selected=scopeContract(scope), analyzer=loadAnalyzer(analyzerRoot);
  return {schemaVersion:1,kind:'mvck-quality-snapshot',collectedAt:new Date().toISOString(),
    method:{analyzer:'eslint',version:ESLINT_VERSION,cc:'classic',sloc:'token-lines-inclusive-v1'},
    scope:selected,files:selected.files.map(file=>measureFile(root,file,analyzer)),verbosity:null};
}

function validateFunction(fn,file,positions) {
  check(label(fn.name) && integer(fn.line,1) && integer(fn.column,1) && integer(fn.endLine,fn.line) && fn.endLine<=file.loc,'Invalid function location.');
  check(integer(fn.cc,1) && integer(fn.sloc,1) && fn.sloc<=fn.endLine-fn.line+1,'Invalid function metrics.');
  // An implicit class-field path and its arrow function can share a source range.
  const id=`${fn.name}:${fn.line}:${fn.column}:${fn.endLine}`;
  check(!positions.has(id),'Duplicate function measurement.'); positions.add(id);
}

function validateFile(file) {
  check(/^[a-f0-9]{64}$/.test(file.sha256),'Invalid source hash.');
  check(integer(file.loc) && integer(file.sloc) && file.sloc<=file.loc && list(file.functions),'Invalid file measurement.');
  const positions=new Set();
  for (const fn of file.functions) validateFunction(fn,file,positions);
}

function validateSnapshot(snapshot) {
  check(snapshot?.schemaVersion===1 && snapshot.kind==='mvck-quality-snapshot','Expected a version 1 quality snapshot.');
  check(label(snapshot.collectedAt) && Number.isFinite(Date.parse(snapshot.collectedAt)),'Collection time is required.');
  check(snapshot.method && ['analyzer','version','cc','sloc'].every(k=>label(snapshot.method[k])),'Record analyzer version, CC variant and SLOC method.');
  const scope=scopeContract(snapshot.scope);
  check(list(snapshot.files) && snapshot.files.length===scope.files.length,'Every scoped file needs a measurement.');
  uniquePaths(snapshot.files.map(f=>f.path));
  check(digest(snapshot.files.map(f=>f.path).sort())===digest(scope.files),'Measured files differ from the explicit scope.');
  snapshot.files.forEach(validateFile);
  return scope;
}

function verbosityReport(snapshot) {
  const input=snapshot.verbosity;
  if (input===null || input===undefined) return {status:'not-measured',ratio:null};
  check(label(input.method) && list(input.files),'Record the AST/clone tools, versions and rule profile in verbosity.method.');
  uniquePaths(input.files.map(f=>f.path));
  check(digest(input.files.map(f=>f.path).sort())===digest(snapshot.scope.files.slice().sort()),'Verbosity needs both line sets for every scoped file.');
  let count=0;
  for (const file of input.files) {
    const source=snapshot.files.find(f=>f.path===file.path);
    check(list(file.flaggedLines) && list(file.cloneLines),'Both flagged and clone lines are required; missing is not zero.');
    const lines=[...file.flaggedLines,...file.cloneLines];
    check(lines.every(n=>integer(n,1) && n<=source.loc),'Verbosity lines must lie within the measured file.');
    count+=new Set(lines).size;
  }
  const loc=snapshot.files.reduce((sum,f)=>sum+f.loc,0);
  return {status:loc?'measured':'undefined-empty-scope',method:input.method,flaggedOrClonedLines:count,ratio:loc?count/loc:null};
}

function summarize(snapshot) {
  const functions=snapshot.files.flatMap(f=>f.functions.map(fn=>({path:f.path,...fn,mass:fn.cc*Math.sqrt(fn.sloc)})));
  const hotspots=functions.filter(fn=>fn.cc>10).sort((a,b)=>b.mass-a.mass);
  const totalMass=functions.reduce((sum,f)=>sum+f.mass,0), highComplexityMass=hotspots.reduce((sum,f)=>sum+f.mass,0);
  return {fileCount:snapshot.files.length,functionCount:functions.length,
    loc:snapshot.files.reduce((sum,f)=>sum+f.loc,0),sloc:snapshot.files.reduce((sum,f)=>sum+f.sloc,0),
    maximumCC:functions.reduce((max,f)=>Math.max(max,f.cc),0),totalMass,highComplexityMass,
    erosion:totalMass?highComplexityMass/totalMass:null,hotspots,verbosity:verbosityReport(snapshot)};
}

function compareSnapshots(snapshot,summary,baseline) {
  const beforeScope=validateSnapshot(baseline), before=summarize(baseline);
  const comparable=digest(beforeScope)===digest(scopeContract(snapshot.scope)) && digest(baseline.method)===digest(snapshot.method);
  const result={status:comparable?'comparable':'not-comparable',baselineDigest:digest(baseline),
    reason:comparable?'Same explicit files, exclusions and measurement methods.':'Scope or analyzer methods changed; rebaseline and review coverage.',
    delta:comparable?Object.fromEntries(['loc','sloc','functionCount','maximumCC','totalMass','highComplexityMass','erosion'].map(k=>[k,summary[k]===null || before[k]===null?null:summary[k]-before[k]])):null};
  const verbosityComparable=comparable && before.verbosity.status==='measured' && summary.verbosity.status==='measured' && before.verbosity.method===summary.verbosity.method;
  result.verbosityDelta=verbosityComparable?summary.verbosity.ratio-before.verbosity.ratio:null;
  return result;
}

export function qualityReport(target,snapshot,baseline) {
  const root=projectRoot(target), scope=validateSnapshot(snapshot);
  for (const file of snapshot.files) {
    const resolved=safePath(root,file.path);
    check(fs.statSync(resolved).size<=2*1024*1024,'Source file exceeds 2 MiB.');
    assert(sha256(fs.readFileSync(resolved))===file.sha256,'QUALITY_STALE',`Source changed since measurement: ${file.path}`,7);
  }
  const summary=summarize(snapshot), result={schemaVersion:1,kind:'mvck-quality-report',snapshotDigest:digest(snapshot),
    status:'review-signals',correctness:'not-assessed',trust:'local measurements; not independent attestation',scope,method:snapshot.method,...summary};
  if (baseline) result.comparison=compareSnapshots(snapshot,summary,baseline);
  return result;
}
