---
name: mvck-explain-again
description: Explain an unclear previous answer using the user's language and existing project terms, without starting another task. Use when the user explicitly requests this skill.
argument-hint: "optional: a sentence or topic to explain"
disable-model-invocation: true
---

# MVCK Explain Again

Help the user understand an answer already in the conversation. An optional argument selects a sentence or topic; otherwise cover the previous answer. This invocation changes the explanation, not the project.

## Prepare the explanation

Use the conversation and project context already available. Find the specific gap: an unfamiliar term, missing background, an unexplained transition, or too much detail before the result. Do not fetch files or browse merely to restate the answer. If essential context is unavailable, state the limit and ask one focused question.

## Write the answer

1. State what the previous answer means for the user's task.
2. Supply the background or intermediate step needed to understand it. Explain necessary terminology where it appears. Use one small, clearly hypothetical example when it helps.
3. Keep the original facts, decisions, uncertainty and work status visible. Do not describe a proposed action as completed or turn an assumption into evidence.

Use the user's conversation language. Retain exact code identifiers, commands, paths and error text. Reuse vocabulary from the glossary identified by `backbone.yml` `project.context` when it is already available. Otherwise use established conversation terms and explain them without inventing a project-specific definition.

Choose enough detail to restore understanding. Do not force the answer to be shorter when the missing step needs explanation. A follow-up question is useful only when a particular ambiguity remains.

## Preserve the task boundary

This skill authorizes an explanation only: no tool calls, file changes, external actions or new implementation. If the earlier answer contains a demonstrable error, identify it plainly instead of repeating it; state any uncertainty and leave corrective project work to the user's existing or subsequent task instructions. Do not expose private reasoning traces.

The invocation does not replace standing project rules or set a new style for the rest of the session. Before sending, check that the explanation preserves the original work status and addresses the selected gap.

## Provenance and license

This MIT-licensed MVCK variant replaces the kit's earlier skill identifier. Its history is related to Matt Pocock's explanation-repair skill. The instructions above were rewritten for this kit; that rewrite does not establish clean-room independence or erase inherited rights. Retain [the upstream notice](UPSTREAM-NOTICE.md) with copies. No affiliation or endorsement is implied.
