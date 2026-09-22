# Decisions and prototypes

For a choice that affects architecture, cost or migration, record the alternatives and the decisive evidence. Avoid scoring tables whose numbers have no measurement basis.

| Option | What it does | Cost | Risk | Recommended |
| --- | --- | --- | --- | --- |
| Extend the existing boundary | Adds the needed behavior within current ownership | Small implementation | Existing constraints still apply | Yes |
| Introduce a new subsystem | Creates an independent boundary and migration | Larger implementation and support | More interfaces to verify | No |

This is a format example, not a default technical recommendation. Choose from the actual repository evidence.

## Prototype record

- Question: one uncertainty the experiment can settle.
- Scope: exact disposable or approved paths.
- Budget: maximum time, tool calls and iterations.
- Oracle: observable pass/fail condition.
- Result: evidence reference and digest.
- Disposition: integrate, preserve for review, or recoverably discard.
- Remaining risk: what the experiment did not establish.

## Reopen reasons

Use a concrete reason: changed requirement, contradicted source, failed acceptance check, scope conflict, unavailable capability or exhausted budget. Preserve the prior decision's digest. Reopen only affected work, then revalidate every retained proof against the new contract.
