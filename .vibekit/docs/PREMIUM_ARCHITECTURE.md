# Premium architecture decisions

## ADR 1: Preserve the repository layout

Keep canonical skills in `.vibekit/skills` and reusable modules in `.vibekit/scripts/premium`. The existing CLI delegates new namespaces to that module boundary. A package monorepo is unnecessary for this development release.

The v3 distribution manifest extends the existing `name` and `surfaces` array. It adds version, license, access, compatibility, dependencies, conflicts and capabilities. The public reader also accepts v2 and normalizes it without writing. This is the implemented contract; illustrative descriptor shapes in the research plan are design alternatives.

## ADR 2: One transaction engine

Both bundled skills and signed offline artifacts use expected-preimage plans and the same writer mutex, journal, stage, archive, publish, validate and rollback sequence. Approval binds to the canonical plan digest. Foreign or modified files are never silently adopted.

Removal is archival. Receipts retain pre-images, quarantined post-images and mutex history. Do not automatically purge receipts: they can contain prior instructions and deserve local access and retention review.

This is a compensating file transaction, not a filesystem-wide atomic commit. Cooperative CLI writers are serialized. Hash checks and symlink guards catch observable drift; they do not replace an OS sandbox against an adversary changing paths between checks. Abrupt power-loss durability is not certified.

## ADR 3: One task record

Store TaskBrief, SpecSnapshot, DecisionRecord, Ticket, Evidence and TaskClosure data in one versioned `task.json`, plus a derived `TASK.md`. The record avoids requiring separate REFERENCES and FINAL files for every task. Existing Agent Control Center and Proofline authority envelopes remain separate: a task record supplies scope/evidence data and grants no controller or tool authority.

## ADR 4: Provider fragments preserve user configuration

Adapters are pure generators. The current version returns fragments with a policy digest, dated sources, unsupported settings and enforcement limits. It does not merge arbitrary TOML/JSON, install providers, probe authentication or modify user settings. Copilot/Grok/Kimi policy prose is explicitly instruction-only.

## ADR 5: Use Git's worktree registry

Avoid a second ownership database that can diverge after ordinary Git commands. Reconcile against `git worktree list --porcelain -z`, HEAD, branch, dirty/ignored state and path guards before each mutation. The first version creates new branches from HEAD and preserves existing branch refs on clean removal.

## ADR 6: Bounded signed offline bundles

Use `mvck-file-bundle-v1`, a JSON object containing canonical base64 regular files. Compression, archive extraction, links, executable lifecycle hooks and automatic downloads are unsupported. This narrows the artifact attack surface and permits exact pre-write validation.

Signed payloads use the `mvck-canonical-json-v1` encoding: sorted object keys, preserved array order, JSON string escaping, no whitespace, and safe integer numbers only. The signature covers those UTF-8 payload bytes. This constrained encoding is documented explicitly and is not advertised as a general RFC 8785 or JWS implementation.

## ADR 7: Development edition before commercial release

Package identity: `minimal-vibe-coding-kit-premium`, private. The current version is recorded in `.vibekit/KIT_VERSION` and the [release record](PREMIUM_RELEASE.md). Managed-block markers remain `minimal-vibe-coding-kit` for compatibility. Original Premium work uses Bui Van Giang's proprietary license; inherited MIT components and prior grants remain excluded. See [license scope](PREMIUM_LICENSE.md). The local catalog's `community` access tier identifies the unsigned bundled install route, not a legal license. Production service configuration and the commercial artifact release are separate acceptance gates.
