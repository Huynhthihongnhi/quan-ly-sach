# Task contract

## One record

Use one `task.json` plus its generated `TASK.md`. The JSON record contains the brief, context snapshot, source claims, decisions, tickets, evidence and revision history. Separate `REFERENCES.json` or `FINAL.json` exports are unnecessary unless another system requires them. This avoids divergent copies of the same acceptance criteria.

Task phases are `target`, `explore`, `execute`, `verify`, `closed` and `blocked`. `inspect` describes the read phase that prepares the initial target. Advance one phase at a time. `finish` requires the verify phase and complete evidence. `refresh-context` increments the revision, records prior digests, invalidates evidence and returns to target for revalidation. Use `task revise <id> --input revision.json` to change goal, scope, nonGoals, criteria, risk or budget. A revision clears old decisions, tickets and evidence.

## Brief

Required fields: `goal`, `scope` and `criteria`. Each criterion has `id`, `description` and `requires`. Evidence types are `static`, `unit`, `contract`, `integration`, `e2e`, `visual` and `manual`.

Keep scope concrete, such as `src/checkout` and `test/checkout`, with non-goals for adjacent systems. Credential paths are excluded from snapshots. For a Git repository, the snapshot hashes scoped tracked and untracked files plus root instructions. Task records and local receipts are excluded to avoid circular hashes.

Default interview budgets are one question for low risk, three for medium risk and six across multiple rounds for high risk. Three is the per-round maximum. Budget fields are host execution limits; this local record tool does not run or police an autonomous agent loop.

## Source claims

A claim contains `id`, `source`, `statement`, `retrievedAt`, `version`, `stability`, `refreshAfter`, `status`, `material` and optional `contradicted`. Use `pinned` for an immutable source and a concrete deadline for volatile facts. Mark an assumption separately with an expiry and affected action. A new date alone is not evidence that a source was checked.

## Tickets

Each ticket names `id`, `owner`, `paths`, `criteria`, `revision` and `status`. Active tickets owned by different writers must have disjoint paths. The task tool validates the declared scopes; it does not enforce filesystem or API isolation.

Ticket status is `planned`, `active`, `done`, `blocked`, `cancelled` or `stale`. Closure requires each ticket to be done or cancelled, each decision to have a selected option and each prototype to have a recorded disposition. Resolve refreshed stale tickets before closure.

## Evidence

After implementation, refresh context, recheck affected decisions and advance to verify. Store command output in an approved evidence directory outside the mutable source scope. Add records with `task record <id> --input <record.json>`.

An evidence record names `id`, `criterion`, `type`, `status`, current `revision`, current `contextDigest`, `observation`, `reference`, `sha256` and `observedAt`. Executable evidence also needs `command` as an argv array and `exitCode: 0` for a pass. A matching log hash proves the log is unchanged, not that an external observer ran the command.

Do not edit task contract fields in place. Use the revision workflow for changed intent. If a record is manually corrupted, restore its transaction pre-image before continuing. Closure fails when required evidence is missing, failed, stale or bound to different source bytes.
