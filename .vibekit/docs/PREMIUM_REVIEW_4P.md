# Current changes: 4P review and remaining blind spots

Review date: 2026-09-16. Candidate: 0.6.2, private and unpublished. Scope: all current tracked changes and untracked Premium additions, including the earlier development and 0.6.1 preparation work. Baseline: `50ff0431796de771d509ea4caebd4b0042dcc1b1`. Source hashes and the initial diff are retained in source-checkout `.vibekit/local/review-2026-09-16/`; an uncommitted tree cannot be reproduced from HEAD alone.

Method: Sequential Thinking, Clear Thought, Reviewing 4P Priorities, threat-model review and the required AgentShield probe. This is a sequential self-review. It does not claim independent reviewers, a Proofline seal, legal clearance or live payment testing. The older 0.6.1 Proofline record applies only to its recorded inputs.

## Findings, highest priority first

### R1. P1: legal and commercial launch conditions remain unresolved

Status: **open, static-confirmed readiness gap**. The license names a licensor, but the repository has no authentic counsel review, confirmed contracting entity, finalized buyer terms or qualified assessment of intended markets. The owner now intends international reach. Provider country support cannot supply that assessment. Evidence: [legal brief](PREMIUM_LEGAL_REVIEW.md), [global sales](PREMIUM_GLOBAL_SALES.md), [release gates](PREMIUM_RELEASE.md).

Impact: a paid launch could promise terms or availability that have not been reviewed for the actual seller and buyers. This is P1 because it blocks the requested commercial launch. It is not P0: no live sale, customer harm or active breach was demonstrated. It is more than P2 because the uncertainty affects every new paid order, not one optional command.

Smallest next action: owner completes seller/offer facts, engages qualified counsel, resolves written conditions, then binds approved documents to release digests. Authentic counsel review and the owner's distribution decision are the acceptance evidence. An AI review cannot close this finding.

### R2. P1 for launch: checkout, fulfillment and update promises are not operational

Status: **open, static-confirmed readiness gap**. `premium/entitlements.mjs` is a local reducer, `license status` reports an unconfigured service, and no provider account or order evidence is present. A 12-month update offer needs per-customer tracking. Adding a new file to a shared Polar benefit grants access retroactively to current benefit holders. Evidence: [selling guide](PREMIUM_SELLING.md), [Polar file downloads](https://polar.sh/docs/features/benefits/file-downloads).

Impact: accepting money before verifying the advertised path risks missing downloads or incorrect future access. P1 applies to opening that offer; it is not a P0 outage of an existing service. It exceeds P2 because purchase and delivery are the central journey.

Smallest next action: operate one clearly defined one-time offer through hosted checkout and file delivery, with explicit update terms. Test paid purchase, 100% gift, failed purchase, refund, access and installation in the selected provider's sandbox. A custom activation backend is optional for this first route. Subscription and automated cutoff promises remain gated by their own scenarios. No production setup was performed by this review.

### R3. P2: explicitly scoped ignored inputs did not invalidate task evidence

Status: **fixed, runtime-validated regression**. Input: a task explicitly selects a safe file or directory ignored by Git. Path: `tasks.mjs::contextSnapshot` used only `git ls-files --cached --others --exclude-standard` when Git succeeded. Sink: the omitted file never entered the digest compared by `verifyTask`. Changing it could leave old context accepted.

The new regression failed before the fix with an absent expected input hash. The implementation now walks explicit scopes, records missing paths, deduplicates hashes and retains scope/size/path limits. A broad `.` Git scope still respects ignore rules; sensitive inputs remain excluded. The test checks direct-file changes, nested-file changes and creation of a missing input, and observes `context-drift`.

P2: the issue undermined evidence freshness for a bounded scope with a workaround (track the input). P1 would overstate its reach; normal tracked inputs already worked. P3 would understate invalid evidence acceptance. This finding is not an external code-execution exploit or independent evidence attestation.

### R4. P2: important regression tests were outside the default test command

Status: **fixed, static-confirmed test wiring and executable verification**. `package.json` previously ran only `contracts.test.mjs` and `quality.test.mjs` in `test:premium`. Six existing ownership/runtime/provider regression tests needed a separate manual invocation and were absent from the CI path using that script.

The default command now includes `review-regressions.test.mjs`, including the new context and installed-document cases. P2 reflects a bounded but important release regression gap; no live P1 failure was observed, and ownership protections make it more than test-layout polish. Validate through `npm test` and the configured portability job when CI runs.

### R5. P2: installed Premium guides had six broken local links

Status: **fixed, runtime-validated regression**. The whole-kit installer copies `.vibekit/docs/`, but not source research `docs/premium-minimal/` or the maintainer release runbook. Five Premium guides linked to those missing files, including the actionable legal brief. A fresh-install regression reproduced six missing targets.

The current legal brief now ships at `PREMIUM_LEGAL_REVIEW.md`. Installed guides use shipped targets and explicitly label source-only research/runbook paths. The regression opens links from Premium guides in an actual installed project. P2: this blocked navigation to required handoff/release information but had a source-checkout workaround. It is not a P1 installation failure and affects more than P3 formatting.

### R6. P3: current guidance and historical snapshots were easy to confuse

Status: **fixed in documentation**. The live architecture ADR still named 0.6.0. The research index pointed readers at a historical review as current. The updated [documentation map](DOCUMENTATION_MAP.md) marks active guides, incomplete operational work, generated files, templates and completed snapshots. The current index points to this review and the current brief. Versioned archives and earlier legal grants remain unchanged.

P3 reflects navigation/version clarity; actual broken links are separately tracked as R5. The absence of a generated dashboard or extra documentation automation is not a P4 implementation obligation.

No P0 finding was substantiated in this review. That statement is limited to the inspected changes and local probes.

## Coverage and counterchecks

| Surface | Review / evidence | Limits |
| --- | --- | --- |
| Premium CLI, catalog, modular ownership and delivery | Static flow review plus contract/regression suites; plans bind expected hashes and approval digest | Host-level concurrent malicious filesystem changes are outside the compensating transaction guarantee |
| `common.mjs`, `transaction.mjs`, signed artifacts | Containment, symlink/hardlink checks, bounded inputs, signature/trust and rollback paths; existing adversarial contracts | No external exploit target or production signing infrastructure tested |
| `tasks.mjs`, schemas and generated task reports | Revision, evidence hash and freshness checks; R3 fix and negative controls | Operator observations are not independently authenticated command execution |
| Provider policy proposals and command classifier | Dated sources, proposal-only output, advisory classification, unmapped operations and no automatic configuration write | No provider runtime deny/allow attestation; source expiry still requires future refresh |
| Git/worktree/history/PR modules | Explicit argv, filtered Git environment, local previews, registry and dirty/ignored safeguards | No push, hosted PR, real provider session or destructive production action tested |
| Local entitlement reducer | Replay/ordering and refund boundaries; explicit fixture-only webhook helper | No HTTP server, durable provider inbox or production adapter exists |
| Quality collector | Scope/hash validation, pinned optional analyzer and no execution of project config; quality contracts | Optional external analyzer integration not rerun for this review; no invented complexity score |
| Legacy installer/update, doctor, initialization/finalize, validator | Review changed hunks; installer/regression suite; same-project guards and ownership checks | Legacy update has a preflight guard, not the modular transaction mutex; run one installer at a time |
| Agent instructions, canonical skills, new closed-loop references and provider mirrors | Review canonical changes; validator checks discovery and byte parity; AgentShield probe | Probe is not a full external scanner grade or proof of independent isolation |
| Package/plugin/catalog version, CI and release packaging | Version checks, lifecycle-disabled archive, package inventory and archive smoke receipts | CI workflow reviewed locally; macOS local execution does not prove Windows/Node matrix results |
| Root terms, notices, contributor policy, current/localized docs and research | Ownership boundaries and notice copies checked; docs classified; current links exercised after install | Translation certification and counsel's jurisdiction-specific interpretation remain outside this engineering review |

Rejected or bounded hypotheses:

- Delivery-supplied `cliVersion` cannot raise the verifier's actual version: the installed kit marker overrides that input and a signed compatibility test covers it.
- Arbitrary target traversal is not demonstrated: relative path validation, safe path checks and transaction scope checks precede writes in the inspected paths.
- `verifyWebhookHmac` is not a production Polar verifier: the code/docs describe a local helper and require a provider-specific adapter. Treating the helper as deployed would create a false finding.
- A signed lease expiring while a user approves installation is rechecked before artifact apply. Online revocation and post-download recall are separate, unavailable capabilities.
- Caller-provided offline trust keys are an explicit operator review boundary. No controlled production trust registry is claimed.

## Validation record and next work

The source-checkout evidence directory contains raw command outputs and receipts for this review. The fresh candidate's archive, SHA-256, file manifest and install smoke live under `.vibekit/local/releases/0.6.2/`. They are excluded from customer packages. Consult their exit codes and source hashes for the completed run; this shipped report cannot contain the hash of its own containing archive.

Required checks: `npm test`, `npm run security:probe`, `npm run pack:dry-run`, `git diff --check`, and installation/update of the actual new archive in disposable projects. The two new regressions were observed failing before remediation. Security probe results do not replace live payment, legal or provider runtime evidence.

Next in order: resolve R1 with counsel and the owner; configure and verify the chosen R2 offer; approve the exact archive and production distribution. Windows CI, live provider enforcement and optional integrations remain explicitly unverified until run. Keep completed historical evidence; do not infer that a completed document means its proposed service was built.
