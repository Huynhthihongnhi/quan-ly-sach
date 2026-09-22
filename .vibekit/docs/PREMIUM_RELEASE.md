# MVCK Premium 0.6.3: private review candidate

Prepared: 2026-09-16. Legal review: pending. Sales approval: pending. Publication: private and unpublished. This candidate is for owner and counsel review. Its version number is an artifact identity, not legal clearance or a paid-service launch.

## What this version contains

- The current MVCK Premium License 1.0 for original Premium work, with Bui Van Giang named as licensor.
- Inherited MIT and third-party notices, including the 26 inherited MIT skill lineages. The license text is carried into whole-kit and standalone Premium skill installations; this is not a certification that all provenance questions are resolved.
- `mvck-explain-again` replaces the earlier explanation skill ID, with rewritten instructions, an exact upstream notice and an inherited MIT license for standalone use. See the [provenance review](SKILL_PROVENANCE_REVIEW.md) and [migration](PREMIUM_MIGRATION.md#renamed-explanation-skill-in-063).
- `closed-loop-engineering` 1.0.3, incremented because its bundled notice changes, and the existing Premium runtime and workflows.
- Synchronized package, plugin, skill catalog, kit marker and current guide versions.
- Signed artifact compatibility checks use the installed kit version marker, including when a customer project has its own unrelated package version. Delivery input cannot override that marker.
- Explicit task inputs now detect changes even when Git ignores them; the default Premium suite includes review regressions.
- Installed Premium guide links resolve inside customer projects. International-sales scope, a documentation map and a Vietnamese delivery guide clarify pending operations.
- A [counsel review brief](PREMIUM_LEGAL_REVIEW.md) and explicit release conditions.

The `0.6.0` MIT-era review archive and the `0.6.1` and `0.6.2` private review archives remain historical evidence with their original terms and digests. The Premium license wording has not changed in 0.6.3; the third-party notices have been supplemented. This candidate does not relabel earlier archives or replace earlier grants. Current license wording is supplied for counsel review; preparing this candidate does not certify enforceability.

The package uses `0.6.3` because bundled skill compatibility ranges accept numeric releases and exclude prereleases unless named explicitly. Compatibility ranges remain unchanged. The package remains `private: true`.

## Required gates

| Gate | Current state | Evidence needed to complete it |
| --- | --- | --- |
| Counsel engagement and legal review | Pending | Authentic written review of the exact license, sales terms and intended markets |
| Ownership and earlier grants | Pending owner/counsel review | Contributor permissions and component provenance supporting the proposed scope |
| Final offers and customer terms | Pending | Seller details, buyer markets, price, updates, renewal, cancellation, refunds and acceptance process |
| Technical candidate checks | Record in local release evidence | Full repository validation, AgentShield probe, archive inspection and install/update checks |
| Payment and delivery operations | Unconfigured | Approved provider account and relevant sandbox purchase, cancellation, refund and access results |
| Commercial distribution | Pending Owner approval | Completed legal and applicable operational gates, then approval of the exact version and archive digest |

A manual sales process needs its own reviewed order, acceptance, payment and delivery evidence. It does not require claiming that unfinished online activation works. A manual gift still needs a named written grant and the owner's approval of the supplied version and terms.

## Local release evidence

The preparation task stores its private artifacts under `.vibekit/local/releases/0.6.3/` in the source checkout. This ignored directory is excluded from the package. It contains the archive, SHA-256 file, source and package manifests, command receipts and archive smoke results when preparation completes. The [0.6.2 4P review](PREMIUM_REVIEW_4P.md) records earlier coverage and open gates; the [0.6.3 provenance review](SKILL_PROVENANCE_REVIEW.md) covers this rename and notice repair. Both are sequential self-reviews, not independent Proofline seals. The prior 0.6.1 Proofline record remains scoped to its own archive. These records describe the dirty working tree used for packaging; the baseline Git commit alone does not reproduce this candidate.

Keep release evidence separate from the archive it measures. An archive cannot include a report claiming the SHA-256 of that same archive without a circular dependency. Customer files contain this stable release record; the exact final digest and check results belong beside the archive.

To prepare another candidate, follow the source-checkout runbook `.vibekit/init/PUSH_TO_GITHUB.md` and [archive preparation](PREMIUM_FRIEND_HANDOFF.md#2-owner-prepare-the-downloadable-kit). Use an empty private output directory, disable package lifecycle scripts, inspect the archive and retain its digest. Never overwrite a supplied archive. Changed bytes or terms require a fresh package version and repeated relevant checks.

## After counsel responds

1. Resolve the owner facts and counsel conditions in the private review record. Keep privileged advice and customer data out of distributable files.
2. Apply the approved terms and synchronize every bundled license/notice copy. If the terms change, assign a new license identifier as appropriate and a new package version for changed release bytes.
3. Rebuild and verify that version. Tie the authentic counsel review to the exact final document digests and record any remaining conditions.
4. Complete the applicable sales and fulfillment tests, then obtain the owner's approval for the exact distribution action and archive digest.

Until these steps are complete, the commercial release remains pending. No tag, remote release, npm publication or payment activation is established by this record.
