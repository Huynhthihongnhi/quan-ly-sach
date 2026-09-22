# Minimal Vibe Coding Kit Premium

Version: 0.6.3. Status: local development edition, unpublished. The package is marked private to prevent accidental npm publication.

Start with [everyday kit usage](PREMIUM_START_HERE.md). For the new workflows, see [code quality](PREMIUM_QUALITY.md), [selling from Vietnam with Polar, Stripe or PayPal](PREMIUM_SELLING.md), and [friend coupons](PREMIUM_COUPONS.md).

## What is available

- A version 3 catalog for 27 bundled skills, with per-skill licenses, versions, dependencies, compatibility and capabilities.
- A modular skill installer with preview, exact plan approval, ownership, checksums, archival removal and recovery receipts.
- Closed-loop task records with scoped context, decisions, source claims, tickets and criterion-linked evidence.
- Pure provider policy proposals for Claude, Codex, Cursor and OpenCode. Copilot, Grok and Kimi also have instruction-only policy guidance.
- Local Git history and PR previews, plus explicitly approved sibling worktree operations.
- Ed25519 verification and transactional installation of signed offline skill packages using operator-reviewed public keys.
- Read-only complexity measurement using an optional pinned ESLint installation, source-bound reports and comparable baseline checks. Clone/AST verbosity findings can be imported; detectors are not bundled.

The existing whole-kit install, update, init, doctor, validation and finalize commands remain available. Their legacy behavior is distinct from the new preview-first `skill` commands. See [migration](PREMIUM_MIGRATION.md) before adopting an existing installation.

## Try the local source

From this repository:

```sh
node bin/mvck.js skill list
node bin/mvck.js skill info closed-loop-engineering
node bin/mvck.js capabilities --json
```

Preview one skill in an existing project directory:

```sh
node bin/mvck.js skill add closed-loop-engineering --target /path/to/project --provider codex --json
```

Review the operation paths and `sha256`. Apply the same plan using its exact digest:

```sh
node bin/mvck.js skill add closed-loop-engineering --target /path/to/project --provider codex --apply --accept-plan-sha256 <approved-digest>
```

`--apply` without a digest is available only in an interactive terminal, where it displays the plan and asks for the literal answer `apply`. Automation needs the digest. A changed source, target, provider selection or ownership record requires a fresh preview.

The published command, after a separately approved release exists, will use the exact package version, for example `npx minimal-vibe-coding-kit-premium@0.6.3 skill list`. This command is a release target, not a claim that the version is currently on npm. Use the local source or a reviewed local npm tarball today.

## Skill lifecycle

```sh
node bin/mvck.js skill update closed-loop-engineering --target /path/to/project
node bin/mvck.js skill doctor closed-loop-engineering --target /path/to/project
node bin/mvck.js skill remove closed-loop-engineering --target /path/to/project
node bin/mvck.js transaction status --target /path/to/project
node bin/mvck.js transaction rollback <transaction-id> --target /path/to/project
```

Update and removal preview by default. Removal archives unchanged owned files in `.vibekit/local/transactions`; it preserves adopted files, dependencies and task records. Modified owned files are conflicts, including edits that happen to match a newer upstream file.

`.vibekit/skill.lock.json` records resolved versions and exact ownership. Treat it as protected state. The explicit installer plan authorizes its named state transition; unrelated agent edits to lockfiles remain protected by `backbone.yml`.

The local catalog contains one immutable bundled version per skill in the stable channel. Unsupported channels, unknown dependencies and unavailable versions fail with a clear error. There is no hidden registry lookup, package execution or lifecycle hook.

## Closed-loop tasks

Use the `closed-loop-engineering` skill or `/closed-loop` command. A task normally follows Inspect, Target, Explore, Execute, Verify and Close.

```sh
node bin/mvck.js task start checkout --input .vibekit/skills/closed-loop-engineering/assets/brief.example.json --target /path/to/project
node bin/mvck.js task interview checkout --target /path/to/project
node bin/mvck.js task advance checkout --phase explore --target /path/to/project
node bin/mvck.js task advance checkout --phase execute --target /path/to/project
node bin/mvck.js task refresh-context checkout --target /path/to/project
node bin/mvck.js task record checkout --input /path/to/evidence-record.json --target /path/to/project
node bin/mvck.js task verify checkout --target /path/to/project
node bin/mvck.js task report checkout --target /path/to/project
```

Use `task revise <id> --input revision.json` to change goal, scope, criteria, risk or budget. A revision clears old tickets, decisions and evidence. Each mutating task command needs the same preview/apply workflow. Refreshing context increments the revision, invalidates old evidence and returns the task to target. Recheck affected decisions and advance back to verify before `task finish`.

For Git projects, a broad `.` context respects ignore rules. Explicit safe file and directory scopes also include ignored inputs; a missing explicit path is recorded so its later creation invalidates context. Sensitive paths, task records and local receipts remain excluded. Select concrete inputs when ignored specifications or fixtures affect acceptance.

Keep one `task.json` and its generated `TASK.md` per task. Source claims, options, tickets and final evidence live in that record. A criterion requiring integration or visual evidence stays open when only unit tests pass. Evidence file hashes are verified; operator-supplied command observations are not independently authenticated.

## Provider policies

```sh
node bin/mvck.js provider detect
node bin/mvck.js provider plan codex --version 0.147.0 --json
node bin/mvck.js provider plan claude --json
node bin/mvck.js policy show
```

These commands return proposals. They do not rewrite provider configuration or claim live provider validation. Existing settings need a separate diff review. A provider version supplied on the command line is an operator assertion, not runtime attestation. Unknown settings and operations without a complete native translation are listed; stale source snapshots block generation.

The Codex baseline uses `approval_policy = "on-request"` and the workspace sandbox with network access disabled. Optional documented agent settings require the reviewed version snapshot. No model IDs or reasoning levels are guessed. See [the provider source ledger](PREMIUM_SOURCES.md).

## Git and worktrees

```sh
node bin/mvck.js worktree inspect
node bin/mvck.js worktree create --branch feat/checkout
node bin/mvck.js history src/checkout --limit 8
node bin/mvck.js pr preview --input /path/to/pr-payload.json
```

Worktrees use `<repo>.worktrees/<branch-slug>` beside the main checkout. Creation starts at committed HEAD and preserves dirty main-checkout changes. Removal requires a clean, unlocked registered sibling with no ignored files. Branches remain after removal. Submodules, configured checkout filters/LFS and sparse checkouts require a separate reviewed workflow.

Git's worktree registry is the source of truth. The tool disables hooks and filesystem-monitor hooks for its commands. It never stashes, resets, cleans, pushes, moves the main checkout or creates a remote PR. PR previews contain local title/body/base/head plus expected HEAD. Historical commit subjects are bounded, redacted evidence.

## Signed delivery and commercial boundary

`artifact verify --input <delivery.json>` checks a signed release, bounded regular-file JSON bundle and signed entitlement. `artifact add` uses the same installer transaction engine after verification. The input contains public trust anchors and a signed lease; keep it outside the project and do not include a raw license key. This is an operator-controlled offline interface.

Original Premium modules, documentation and the current closed-loop skill use Bui Van Giang's proprietary license. Inherited MIT material and earlier MIT copies keep their existing rights. Premium use requires a purchase or written grant even though bundled installation needs no activation. Read [license scope and customer terms](PREMIUM_LICENSE.md). No production signing key or customer credential is embedded here.

`license status` reports the remaining service setup. Live activation, a payment adapter, production trust anchors, OS credential storage, revocation delivery, rate limits, privacy/legal review and external security review remain release gates. Expiry blocks new entitled delivery; it never removes installed files.

## Verification and release

Run `npm test`, `npm run security:probe`, `npm run pack:dry-run` and `git diff --check`. Tests cover local contracts and synthetic Git/filesystem fixtures; they do not establish cross-platform runtime parity or production service security.

See [architecture and limits](PREMIUM_ARCHITECTURE.md), [security](PREMIUM_SECURITY.md), [recovery](PREMIUM_MIGRATION.md) and the source checkout's `docs/premium-minimal/14-IMPLEMENTATION-STATUS.md`. The [command reference](PREMIUM_COMMANDS.md) is generated from CLI metadata.
