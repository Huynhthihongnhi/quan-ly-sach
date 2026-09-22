# Explanation skill: naming, concept and provenance review

Reviewed: 2026-09-16. Source candidate: 0.6.3. Outcome: rename `wait-what` to `mvck-explain-again`, rewrite the instructions, retain MIT licensing and carry the reviewed upstream notice with every skill copy. This is an engineering and source review, not a legal opinion or a trademark clearance.

## Evidence and remaining uncertainty

The imported MVCK baseline `50ff0431796de771d509ea4caebd4b0042dcc1b1` already contains `wait-what`. The older changelog expressly describes an upstream concept but does not identify its author or imported revision. The previous third-party notice named MVCK contributors and Mermaid, without a Matt Pocock notice.

The closest primary source identified is [Matt Pocock's skill](https://github.com/mattpocock/skills/blob/959a8e9f1edc3adbe2f7e3054bb6fbefa6696260/skills/productivity/wait-what/SKILL.md). It uses the same identifier and combines explanation repair, simplified English and project vocabulary. That repository's [license at the same revision](https://github.com/mattpocock/skills/blob/959a8e9f1edc3adbe2f7e3054bb6fbefa6696260/LICENSE) is MIT and identifies Matt Pocock as copyright holder.

This is strong evidence of a relevant upstream relationship, not proof of the exact historical import. The owner did not supply an original source link during this review. The reviewed revision is a pinned snapshot retrieved now; do not present it as the original imported commit. Preserve the MIT notice conservatively and ask the owner to supply any additional source or contributor records to counsel.

## What the legal distinction means for this change

The U.S. Copyright Office distinguishes an underlying idea or method from its original written expression. Its guidance also distinguishes short names from potentially protected text and notes that trademark law can apply to names. Therefore, sharing the general purpose of explaining an answer again does not by itself establish copied protected expression. Renaming also does not cure copied expression or a missing license notice. This is an application of the distinction for review purposes, not a ruling on this skill. [Copyright Office Circular 33](https://www.copyright.gov/circs/circ33.pdf).

MIT permits modification and commercial distribution subject to its notice condition. Keep the upstream copyright and permission notice with copies or substantial portions. The new name uses the kit's `mvck` prefix to distinguish its variant; no affiliation or endorsement is claimed. That is not a worldwide trademark search. [Upstream MIT license](https://github.com/mattpocock/skills/blob/959a8e9f1edc3adbe2f7e3054bb6fbefa6696260/LICENSE), [USPTO explanation of trademark and copyright](https://www.uspto.gov/trademarks/basics/trademark-patent-copyright).

For international sales, counsel must assess the actual lineage and relevant law. Copyright is territorial, and the source review cannot guarantee that no other rights or contributors exist. [WIPO copyright FAQ](https://www.wipo.int/en/web/copyright/faq-copyright). The prior [legal launch gate](PREMIUM_LEGAL_REVIEW.md) remains open.

## Concept changes

| Aspect | Earlier MVCK skill | Renamed MVCK variant |
| --- | --- | --- |
| Identity | Same identifier as the identified upstream skill | `mvck-explain-again`; no alias registered under the old name |
| Purpose | Re-explain an unclear prior response | Preserved as a general communication function |
| Organization | One list of repair rules and fixed completion conditions | Select the gap, explain the meaning and missing context, then check facts and work status |
| Length | Required a shorter response | Enough detail to explain the missing step, even when a little longer |
| Language and vocabulary | Per-language rules, glossary and English standard reference | User's language, exact technical identifiers and already available project vocabulary; no claim of formal standard compliance |
| Missing context | Suggested scaffolding a glossary despite no new work | State the missing context and ask one focused question; no file access or creation |
| Known error | Stop and require a new task for a fix | Identify the error without repeating it; project corrections follow the user's existing or subsequent authorization |
| Authority | No new work or tool calls | Retained; no tools, implementation or external actions are authorized by the explanation request |
| Rights | MIT catalog entry; upstream author not named in local notices | MIT retained, exact upstream notice plus inherited MVCK MIT license shipped with standalone copies |

The new prose was written after inspecting the earlier local and upstream material. It is not a clean-room implementation, and no plagiarism percentage or similarity threshold is used as proof of legality.

## Repository changes and verification scope

- Rename the canonical directory and five physical provider mirrors; Codex and OpenCode share `.agents/skills/`.
- Update the manifest, package inclusion paths, root instructions, provider writing rules, templates, current docs, localized discovery and CLI test invocations.
- Retain the old name only in history, provenance, migration instructions and the manifest conflict entry. A fresh catalog does not register or install it.
- Include `UPSTREAM-NOTICE.md` with the exact Matt Pocock MIT text and pinned source/license digests; include `LICENSE` for inherited MVCK contributions. Keep the root notices and their installed copies synchronized.
- Increment `closed-loop-engineering` to 1.0.3 because its bundled notice bytes change. Its Premium license terms do not change. Keep earlier package archives immutable.
- Verify catalog discovery, actual standalone notice delivery, old-ID removal and new-ID installation, conflict preservation, mirror parity and package contents. Run `npm test`, the AgentShield probe and package dry run. Exact command receipts belong in source-checkout `.vibekit/local/rename-explain-again/` and release evidence.

Manual behavior review: a Vietnamese clarification stays Vietnamese; technical identifiers stay verbatim; missing background may require a longer answer; unavailable glossary content cannot trigger a tool call; an incorrect earlier statement is identified without claiming the project was fixed. These are static scenario checks, not an independent agent behavioral evaluation. The generic Skill Creator validator could not run because its Python environment lacks PyYAML. Inspection also shows that its frontmatter allowlist excludes this repository's established `argument-hint` and `disable-model-invocation` fields. Preserve those fields and use the repository validator for the multi-provider contract; do not report the generic check as passed.

## Existing installations

Use [the rename migration instructions](PREMIUM_MIGRATION.md#renamed-explanation-skill-in-063). Whole-kit updates retain obsolete directories, so an existing customer's old folder needs an explicit, recoverable move out of skill discovery after inspection. A folder named `wait-what` may belong to another author; do not assume every such folder belongs to MVCK. Modular ownership permits reviewed removal of the old kit skill before adding the new one.

Older archives and changelog entries keep their original names and evidence. Do not distribute an old archive as if it contains this notice repair. If earlier copies have been shared, the owner should provide the corrected notice and ask counsel about any further remediation; no recipient contact was performed here.
