# Maintainability checkpoints

Use the existing behavior checks, then review whether the next change will remain understandable. A passing test suite or an AI judge's numeric rating cannot replace this review.

1. Before a substantial change, record the affected source scope, exclusions, analyzer version and counting method. Collect a baseline if the approved tool is available.
2. After implementation, rerun behavior checks and collect current measurements using the same scope and method. Keep originals and source hashes.
3. Inspect changed functions above cyclomatic complexity 10, duplicate logic and new abstraction boundaries. Simplify one cohesive responsibility when it helps; otherwise explain the retained branches and their tests.
4. Review code growth and absolute complex mass alongside ratios. Fewer lines or a lower average is not a success criterion by itself. New easy functions can dilute the denominator.
5. Attach static tool output and a separate manual review conclusion to the criterion. Record not-measured values and review gaps. Refresh task context before final evidence is attached.

Cyclomatic complexity counts independent control-flow paths under the chosen analyzer's convention. It is not correctness, all feasible paths, or an exact test count. The review threshold is proportional and advisory unless the task explicitly requires a stricter gate.

The research-inspired structural signal is `mass(f) = CC(f) * sqrt(SLOC(f))`; erosion is high-CC mass (`CC > 10`) divided by all function mass. Missing or zero denominator means undefined, not perfect. If AST findings and clone lines are both measured, verbosity uses their union per file divided by LOC. Never fabricate zero for an absent detector.

In the full kit, `node .vibekit/scripts/mvck.mjs quality --help` lists the local measurement/report commands. The collector needs a separately approved pinned ESLint installation. It does not install tools, run project config or edit source. Standalone skill users should use their existing approved analyzer and report its actual scope and limits.

Read the full installation's `.vibekit/docs/PREMIUM_QUALITY.md` for the JavaScript adapter's counting details. This is a research-inspired adaptation, not a reproduction of the [SlopCodeBench Python evaluation](https://arxiv.org/html/2603.24755v1). Record language and tool differences before comparing scores.
