# Provider enforcement: what the kit can prove

The Premium CLI generates policy proposals and inspects local provider files. It does not activate hooks or test a running provider's permissions. Use this distinction when reviewing a task, trial or provider configuration.

## Read the output

```sh
node bin/mvck.js provider detect --target /absolute/path/to/project --json
node bin/mvck.js provider plan claude --json
```

`present` means a provider-specific local path exists. `observedPaths` lists those paths. Shared `.agents/skills` alone does not identify Codex or OpenCode. The `configuration` field is the adapter's proposed destination; it may not exist and may require native-provider review.

The existing `control` field describes the adapter mechanism (`sandbox`, `best-effort` or `instruction-only`). It is not an assurance rating. `enforcement.state` describes the available evidence:

| State | Meaning | Current CLI use |
| --- | --- | --- |
| `enforced` | A runtime or deterministic boundary prevents the named action | Never emitted by provider discovery or planning |
| `verified` | Reproducible evidence confirms a condition | Never inferred from config presence |
| `advisory` | A proposal or instruction requests behavior | Generated provider fragment |
| `unavailable` | This operation cannot safely inspect the runtime control | Local discovery without a runtime probe |
| `failed` | Evidence demonstrates a boundary violation | Requires an observed failing probe |

These meanings come from the existing [Proofline control matrix](../skills/proofline-orchestration/references/control-matrix.md). This document does not create another policy registry. Every current provider result has an empty `enforcement.evidence` array. A version passed with `--version` remains an operator-supplied value.

## Before claiming enforcement

For each required boundary, retain the runtime version, effective configuration and policy digest, exact request, result, time and fixture hashes. Run both a denied action outside the allowed scope and an allowed action inside it. A general CLI unit test proves neither provider isolation nor permission enforcement.

Use a disposable fixture for an oracle-protection experiment:

1. Allow edits under `src/`; protect `fixtures/`, the metric command and the adapter itself.
2. Attempt a write to `fixtures/oracle.json`; require denial and an unchanged hash.
3. Write `src/example.txt`; require success.
4. Cover every available mutation route: file tools, shell/interpreter wrappers and exposed MCP tools. Report unavailable coverage.
5. Recheck after provider, configuration or adapter changes. A hook crash or missing hook must not produce an `enforced` claim.

Current Claude hooks support pre-tool decisions, but async hooks cannot block a pending action. A shell hook's non-blocking failure can let execution continue. These properties must be tested for the chosen control. Hooks also execute with the user's privileges; they are not a complete OS sandbox. See the official [hooks reference](https://code.claude.com/docs/en/hooks).

## Claude Mods decision

As checked on 2026-09-15, the [upstream Mods discussion](https://github.com/anthropics/claude-code/issues/91870) describes an evolving interface. Keep Mods as an optional future adapter. No Mod, function hook, wildcard event collector or feature flag is installed by this kit change.

Start with a bounded oracle-protection fixture after verifying the API and actual runtime. Reuse `premium/providers.mjs`, the Proofline vocabulary and the current installer ownership model. Keep coupons, hosted delivery and installation independent of this experiment.

The source checkout contains `docs/premium-minimal/15-CLAUDE_MODS_MVCK_INTEGRATION_ASSESSMENT.md`, the dated integration assessment and next gate. That research folder is not installed into customer projects. The runtime limits above remain the applicable installed guidance.
