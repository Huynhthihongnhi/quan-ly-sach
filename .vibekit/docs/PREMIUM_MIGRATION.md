# Migration and recovery

For the exact download, preview, apply and verification commands, use [the friend install and upgrade guide](PREMIUM_FRIEND_HANDOFF.md). The same whole-kit update path supports an existing OSS installation or an older Premium installation. Run the CLI from the reviewed newer kit, with the application directory as the target.

## From the 0.5.15 whole-kit installation

Before upgrading, review [the current Premium terms](PREMIUM_LICENSE.md) and obtain a purchase or written grant for the new Premium material. Existing OSS copies retain their MIT rights. The closed-loop skill changes to the Premium license at version 1.0.2; older copies lawfully supplied under MIT remain MIT. The update installs the new terms with the kit and preserves your project's own root `LICENSE`.

1. Preserve current user changes and use a reviewed 0.6.3 source checkout or local package.
2. Run the legacy `update <target> --dry-run --json` and review its separate backup behavior.
3. Apply the reviewed whole-kit update without `--dry-run`. This legacy command writes directly and does not use modular `--apply` or a plan digest. Keep backups enabled.
4. Run `doctor` and `validate` against the target from the newer source. Check that the installed `.vibekit/scripts/mvck.mjs capabilities --json` starts.
5. Keep using whole-kit updates unless you need modular ownership. Adoption is optional, not a required OSS-to-Premium step.

For optional adoption, preview `skill add <id> --target <target> --provider <providers> --adopt`. Only identical reviewed files can be adopted. Apply the exact digest and run `skill doctor`. Adopted files survive removal and require manual reconciliation when newer source bytes differ.

## Mixed whole-kit and modular projects

Whole-kit updates skip all skill IDs in the modular ownership ledger. They preserve that ledger and leave user-modified modular files visible as conflicts. Update bundled modular skills with `skill sync` from the newer source; update signed skills with `artifact add` and a new verified delivery. Whole-kit `install`, including `--force`, refuses projects with installed modular skills.

A pending modular transaction blocks legacy install/update at preflight. The legacy updater does not hold the modular writer mutex. Keep a single writer and a separate project backup throughout an update. Its `.vibekit/update-backup/` copies are not `transaction rollback` receipts.

The modular command never fabricates an initialized backbone or overwrites root instructions. Existing `.agents/skills` content is evidence of provider instructions, not proof of another kit's identity. A plain directory can still contain important user files.

## Renamed explanation skill in 0.6.3

The kit now registers `mvck-explain-again` instead of `wait-what`. This is an MIT skill with an upstream notice, not a new proprietary license. See the [provenance and concept review](SKILL_PROVENANCE_REVIEW.md).

For a modular installation managed by MVCK, use the new reviewed CLI to preview `skill remove wait-what --target /absolute/path/to/project --json`. Inspect the ownership record, conflicts and archival plan; apply that exact command with `--apply --accept-plan-sha256 ACTUAL_DIGEST`. Removal works even though the old ID is absent from the new catalog. User-modified files block removal; adopted files remain user-owned. Preserve customizations and move any retained old skill files out of discovery only after inspecting ownership.

Then preview `skill add mvck-explain-again --target /absolute/path/to/project --provider codex --json`, choose your actual provider and apply its reviewed digest. Run `skill doctor`. The new catalog declares a conflict while the old ID remains in the modular ledger. `skill sync` cannot resolve the retired ID; complete this explicit migration first. Keep transaction receipts for recovery.

For whole-kit installations, the normal updater installs the new name and retains old directories. After backing up and checking local edits, move only the old MVCK-owned `wait-what` directories outside all skill discovery roots into a private backup. Possible roots are `.vibekit/skills/`, `.claude/skills/`, `.cursor/skills/`, `.agents/skills/`, `.grok/skills/` and `.kimi-code/skills/`; inspect only the profiles actually installed. Do not move an independently installed upstream skill or another author's files. The CLI does not silently rename or delete these untracked legacy folders.

Update custom project prompts that invoke the kit's old name, then reload the agent's skill catalog or start a new session. Existing session metadata may still list the old identifier. Older MIT grants and preserved backups remain valid; do not rewrite historical release evidence.

## Transaction inspection

```sh
node bin/mvck.js transaction status --target /path/to/project
node bin/mvck.js transaction recover --target /path/to/project
```

An active or interrupted transaction blocks new writes. Recovery previews the receipt, current file hashes and restoration digest. If the recorded writer process still exists, recovery refuses to compete with it. A missing or damaged owner record requires manual inspection of `.vibekit/local/transaction-active`; do not guess ownership or delete the mutex.

## Rollback

Preview `transaction rollback <id>`. Apply with `--apply --accept-plan-sha256 <rollback-digest>`. Restoration verifies every recorded pre-image. New user edits cause a conflict and remain untouched. Recover the later transaction first when several transactions changed the same files.

Pre-images and overwritten outputs remain under `.vibekit/local/transactions/<id>`. Keep this directory local and private. The CLI writes a local ignore rule and adds a root ignore entry during modular skill installation. Do not put license keys or credentials in managed skill files or task records.

The command can recover process interruption after a prepared receipt. A power failure, disk corruption or interrupted mutex creation may require manual recovery. Keep a separate source-control or filesystem backup for those cases.

## Release rollback

Do not replace an immutable signed version with changed bytes. Publish a new version or withdraw the affected release through the production registry. Offline consumers need a fresh trusted withdrawal snapshot. Expired entitlements never trigger project cleanup.
