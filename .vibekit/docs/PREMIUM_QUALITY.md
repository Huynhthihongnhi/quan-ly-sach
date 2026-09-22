# Code quality through repeated changes

Use this workflow when a feature changes branching, duplication or module boundaries. Keep tiny fixes proportional. Passing tests establishes observed behavior; maintainability needs separate evidence and review.

## What the article contributes

Track code growth across checkpoints. Inspect repeated logic and unnecessary abstractions. Measure complex functions, then review whether the structure helps the next change. Do not treat an AI judge's numeric rating as proof, or optimize only for fewer lines.

The pasted article's general claim about near-perfect correctness is not adopted. Its benchmark numbers describe specific experiments. They do not establish a current model ranking or a universal failure rate.

The primary [SlopCodeBench paper, section 3.3](https://arxiv.org/html/2603.24755v1) defines:

```text
mass(function) = CC(function) * sqrt(SLOC(function))
erosion = sum(mass where CC > 10) / sum(all function mass)
verbosity = count(unique AST-flagged OR clone lines) / LOC
```

The square root was lost in the pasted formula. Erosion measures concentration in complex functions. Verbosity counts the union, so an overlapping line contributes once. These are research-inspired review signals; this JavaScript adapter does not reproduce the paper's Python analyzer or its exact rule collection.

## Cyclomatic complexity in plain language

Cyclomatic complexity (CC) counts independent paths through a control-flow graph. For a usual connected function graph, `CC = E - N + 2`, where E is edges and N is nodes. More generally, use `E - N + 2P` for P separate components under the same graph convention. A straight-line function has CC 1; one `if` usually makes it 2.

The user's [GeeksforGeeks introduction](https://www.geeksforgeeks.org/dsa/cyclomatic-complexity/) is a starting point. Actual results depend on the language and analyzer. [ESLint's rule](https://eslint.org/docs/latest/rules/complexity) counts short-circuit expressions, defaults and optional chaining too; its classic and modified switch variants differ. CC describes a basis of paths, not every feasible execution path, correctness, or an exact required test count.

| Observation | Review action |
| --- | --- |
| CC 1-10 | Normal behavior and readability review; low CC is not a quality certificate |
| CC above 10 | Inspect branches, error handling and responsibilities in that function |
| New or worsening hotspot | Simplify within scope, or record why the branches belong together and which tests cover them |
| Higher LOC or lower erosion alone | Inspect the diff and absolute complex mass before judging improvement |
| Missing analyzer or incomplete findings | Record `not-measured`; do not substitute zero |

The cutoff of 10 follows the paper for reporting. It is a review trigger, not a default CI failure or a requirement to split every function. Avoid helpers that merely scatter branches, fewer lines produced by minification, and new easy functions added to dilute the denominator.

## Measure JavaScript in this checkout

The core kit has no new package dependency. The optional collector requires a reviewed installation of **ESLint 10.10.0**, plus Node `^20.19.0`, `^22.13.0` or `>=24`. `quality report` and the existing kit continue to support Node 18. Version checked on 2026-09-15; [ESLint 9 is end-of-life](https://eslint.org/version-support/).

Create an empty tool directory outside the project, then explicitly install the analyzer there. Replace both absolute paths below. Installation is a separate local tooling action; agents must respect the project's dependency approval policy.

```sh
npm install --prefix /absolute/path/to/quality-tools --ignore-scripts --no-audit --no-fund --save-exact eslint@10.10.0
```

Retain that tool directory's lockfile for repeatable installation. Review future analyzer upgrades and rerun the adapter test before changing the pin. The adapter uses ESLint's internal rule API, so its exact version is intentionally fixed.

From the kit checkout, use the [scope example](quality-scope.example.json). Set `files` to exact project-relative source paths and explain exclusions. The example covers only two modules, not the whole kit.

```sh
node bin/mvck.js quality measure --input .vibekit/docs/quality-scope.example.json --analyzer-root /absolute/path/to/quality-tools --json > /absolute/path/to/before.json
node bin/mvck.js quality report --input /absolute/path/to/before.json --json
```

After a behavior change or focused cleanup, collect into a new file and compare:

```sh
node bin/mvck.js quality measure --input .vibekit/docs/quality-scope.example.json --analyzer-root /absolute/path/to/quality-tools --json > /absolute/path/to/after.json
node bin/mvck.js quality report --input /absolute/path/to/after.json --baseline /absolute/path/to/before.json --json
```

Add `--target /absolute/path/to/project` to measure or report on another project. `--input`, `--baseline` and `--analyzer-root` resolve from your current working directory. Store reports outside the measured files, use distinct filenames, and check command exit status before consuming redirected output.

These commands emit JSON and do not modify source. They run the explicitly selected analyzer code; they do not load project ESLint configuration, inline suppressions, hooks or application code. No network request or automatic tool installation occurs. Parse failures and unsupported source types fail visibly.

## What is measured and what is missing

- JavaScript `.js`, `.mjs` and `.cjs`, ECMAScript 2024 syntax, classic CC. TypeScript, JSX and other languages need a separately reviewed adapter; no keyword-count fallback is used.
- Every reported function, including nested functions and ESLint's implicit class initializer/static-block paths. Top-level program branches are outside the function metric.
- Physical LOC, including comments and blank lines. SLOC counts lines occupied by syntax tokens, including braces, excluding comments. Function SLOC includes nested function bodies; aggregate file SLOC counts each token line once. Record this method when comparing tools.
- Source SHA-256, analyzer version, explicit scope, exclusions, function locations, absolute mass, high-complexity mass and hotspots. A report rejects current-source drift. Baseline hashes describe historical bytes and are not checked against today's files.
- A comparison requires identical file sets, exclusions and methods. Scope changes return `not-comparable`. Even comparable scope cannot detect every form of denominator dilution; review changed functions and absolute mass.
- Empty function sets produce `erosion: null`. Reports are local evidence with operator-controlled provenance, not independent attestation. Exit 0 means the report succeeded, not that code passed a maintainability gate.

AST pattern findings and clone detection are **not bundled**. The collector emits `verbosity: null`. To import measurements from reviewed tools, add this object to a snapshot, including every scoped file with both line sets:

```json
{
  "method": "Record AST tool/version/rule profile and clone tool/version/options here",
  "files": [
    {"path": "src/example.js", "flaggedLines": [2, 3], "cloneLines": [3, 4]}
  ]
}
```

Assign that object to the snapshot's `verbosity` field. Line numbers are one-based physical source lines. Empty arrays mean the named tool ran and found none; absent measurements must stay null. The report validates coverage and line bounds, then unions the sets per file. Its source hash cannot prove imported findings are truthful, so retain original tool output. Compare verbosity only with the same tools, versions and rule profile.

## Use with your agent

```text
Use closed-loop-engineering and clean-delivery for this feature.
Keep the agreed behavior and edit scope. Run the existing tests.
Measure complexity before and after if the approved analyzer is available.
Review changed functions above CC 10, duplication, new abstractions and LOC growth.
Explain any regression or unmeasured metric. Keep the simplest tested design.
Attach commands, source-bound reports and the review conclusion to the task evidence.
```

For a substantial task, add a separate maintainability criterion beside correctness. A measurement report is static evidence. The review conclusion is manual evidence. Configure the criterion's required types accordingly; a passing report does not supply that review automatically. Refresh task context after final changes and before attaching fresh evidence. See [task usage](PREMIUM_GUIDE.md).

Reproduce the quality checks with `npm run test:quality`. For the actual optional analyzer integration, run `node test/premium/quality-eslint.mjs /absolute/path/to/quality-tools`. Neither command silently downloads dependencies.
