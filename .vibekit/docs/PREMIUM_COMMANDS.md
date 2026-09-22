# Premium command reference

Generated from `premium/cli.mjs` by `node .vibekit/scripts/check-premium.mjs --write`. Run through `node bin/mvck.js` in the source checkout or a reviewed installed CLI.

| Command | Behavior |
| --- | --- |
| `mvck skill list\|search\|info\|doctor [id]` | Read the bundled catalog and installed file health. |
| `mvck skill add\|plan\|update\|remove <id>` | Preview one skill lifecycle transaction. |
| `mvck skill sync` | Preview synchronization of explicitly installed bundled skills. |
| `mvck transaction status\|recover\|rollback [id]` | Inspect receipts or preview restoration of pre-images. |
| `mvck task start <id> --input brief.json` | Preview a target contract and readable task record. |
| `mvck task status\|interview\|tickets\|verify\|report <id>` | Inspect scope, questions, tickets and evidence. |
| `mvck task record <id> --input evidence.json` | Preview updated evidence, claims or tickets. |
| `mvck task revise <id> --input revision.json` | Revise the target contract and invalidate prior evidence. |
| `mvck task advance <id> --phase explore\|execute\|verify\|blocked` | Preview the next task phase. |
| `mvck task refresh-context\|finish <id>` | Invalidate stale evidence or close a verified task. |
| `mvck provider detect` | Inspect provider files without running provider binaries. |
| `mvck provider plan <provider> [--version <version>] [--input request.json]` | Return a provider policy fragment for review. |
| `mvck capabilities` | Show local capabilities and commercial release gates. |
| `mvck policy show\|classify [--command <text>]` | Inspect neutral policy or advisory command classification. |
| `mvck worktree inspect\|create\|remove [--branch feat/name]` | Inspect or preview a sibling worktree operation. |
| `mvck history <path> [--limit 8]` | Collect bounded, redacted local Git history. |
| `mvck pr preview --input pr.json` | Render a local PR payload without calling GitHub. |
| `mvck artifact verify\|add --input delivery.json` | Verify a signed offline package or preview installation. |
| `mvck license status` | Show entitlement service readiness without network access. |
| `mvck quality measure --input scope.json --analyzer-root <directory>` | Measure explicit JS files with a separately installed, pinned ESLint. |
| `mvck quality report --input snapshot.json [--baseline before.json]` | Check source hashes and report complexity, erosion and optional verbosity. |
| `mvck privacy show` | Show the no-telemetry and credential-storage contract. |

## Plan and apply

Common flags: `--target <existing-directory>`, `--json`, `--dry-run`. Mutations preview by default. Approve the current digest with `--apply --accept-plan-sha256 <digest>`. An interactive terminal can ask for approval after showing the plan. JSON and non-interactive modes always require the digest.

Provider plans and PR previews remain proposals. Legacy whole-kit commands have their own install/update behavior; see [migration](PREMIUM_MIGRATION.md).

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Successful command or read-only preview |
| 1 | Unexpected error or legacy command failure |
| 2 | Invalid input, command, schema or flag |
| 3 | Approval, conflict or task verification gate |
| 4 | Catalog, version, provider or compatibility problem |
| 5 | Entitlement or activation gate |
| 6 | Signature, trust or artifact validation problem |
| 7 | Stale plan, changed path or source bytes |
| 8 | Apply failed and restoration was verified |
| 9 | Pending writer or manual recovery required |
| 10 | Skill health check failed |

JSON errors contain `schemaVersion` and an `error` with a stable `code` and `message`. A preview with conflicts is readable; applying it requires resolving those conflicts.
