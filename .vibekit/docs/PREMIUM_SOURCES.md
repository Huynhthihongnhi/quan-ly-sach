# Premium source ledger

Checked on 2026-09-15. Provider configuration sources expire for generation on 2026-10-15. A provider update, contradiction or security-sensitive change requires earlier revalidation.

| Source | Checked claim | Scope |
| --- | --- | --- |
| [OpenAI configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) | Sandbox and on-request approval keys; documented agent switches and concurrency | Codex proposal snapshot; local CLI observed as 0.147.0 |
| [Claude permissions](https://code.claude.com/docs/en/permissions) | Tool permission rule structure and precedence | Claude proposal, no runtime attestation |
| [Cursor CLI permissions](https://cursor.com/docs/cli/reference/permissions) | CLI allow/deny configuration | CLI proposal only |
| [OpenCode permissions](https://opencode.ai/docs/permissions/) | Permission objects and ordered patterns | OpenCode proposal only |
| [Git worktree manual](https://git-scm.com/docs/git-worktree) | Registry, linked worktrees and clean removal | Local Git workflow |
| [GitHub PR creation manual](https://cli.github.com/manual/gh_pr_create) | Dry-run may still push changes | MVCK builds PR previews locally |
| [Node crypto](https://nodejs.org/api/crypto.html) | Ed25519 verification, hashing and random bytes | Built-in crypto primitives |
| [RFC 8037](https://www.rfc-editor.org/info/rfc8037/) | Ed25519 context for signed objects | Reference; this envelope is not JWS |
| [RFC 8785](https://www.rfc-editor.org/info/rfc8785/) | Need for deterministic JSON signature bytes | Reference; MVCK uses its documented constrained encoding |

The original research folder records the earlier 2026-09-05 design sources. Those citations remain provenance. The implemented schemas, CLI help and current status map define this local version's exact behavior.

## Quality and commerce follow-up

Checked 2026-09-15. Revalidate commerce facts before account setup or production implementation, and analyzer facts before changing its pin. These guide references do not configure a service or grant authority to execute downloaded instructions.

| Source | Checked claim | Scope |
| --- | --- | --- |
| [SlopCodeBench v1](https://arxiv.org/html/2603.24755v1) | Square-root SLOC mass, strict CC above 10, line-set union | Research-inspired signals; not benchmark parity |
| [GeeksforGeeks CC introduction](https://www.geeksforgeeks.org/dsa/cyclomatic-complexity/) | User-requested conceptual starting point | Secondary introduction; implementation follows ESLint |
| [ESLint complexity](https://eslint.org/docs/latest/rules/complexity) and [10.10.0 rule source](https://github.com/eslint/eslint/blob/v10.10.0/lib/rules/complexity.js) | Function paths, defaults, optional chaining and classic switch counting | Optional exact-version JavaScript collector |
| [ESLint support](https://eslint.org/version-support/) | Version 10 supported; version 9 end-of-life | npm metadata verified version 10.10.0 and Node engine range |
| [Polar countries](https://polar.sh/docs/merchant-of-record/supported-countries) and [acceptable use](https://polar.sh/legal/acceptable-use-policy) | Vietnam seller support and product eligibility conditions | Onboarding and product approval still required |
| [Polar fees](https://polar.sh/docs/merchant-of-record/fees) | Current base plans and additional fees | Pricing examples are dated, not a payout estimate |
| [Polar discounts](https://polar.sh/docs/features/discounts) | Discount duration, limits and refund behavior | Friend coupon guide |
| [Polar delivery verification](https://polar.sh/docs/integrate/webhooks/delivery) | Raw-body SDK validation and September 8 signing transition | Future service adapter |
| [Stripe availability](https://stripe.com/global) | Vietnam absent from direct Payments merchant list | Direct Stripe eligibility differs from Connect payouts |
| [Stripe webhooks](https://docs.stripe.com/webhooks) and [coupons](https://docs.stripe.com/billing/subscriptions/coupons) | Signature validation, delivery behavior and promotion codes | Future eligible Stripe account |
| [PayPal Vietnam](https://www.paypal.com/vn/business) and [merchant fees](https://www.paypal.com/vn/business/paypal-business-fees) | Vietnam business offering and applicable fee schedule | Feature/account eligibility still needs confirmation |
| [PayPal verification](https://developer.paypal.com/api/rest/webhooks/rest/) and [subscription events](https://developer.paypal.com/subscriptions/webhooks/) | Webhook verification and recurring payment events | Future PayPal service adapter |

The user-pasted article has no supplied public URL. Its broad correctness claims and model statistics are not adopted as kit guarantees. The original research paper supplies the corrected metric definition; local operator measurements supply this implementation's evidence.

## International-sales follow-up

Checked 2026-09-16: Polar supported countries, MoR scope, fees, discounts, checkout links and file-download behavior; the EU, UK, Australia, US and Vietnam primary sources linked in [the global sales review](PREMIUM_GLOBAL_SALES.md). This check does not refresh the separate provider configuration snapshot above. Revalidate commerce policies at launch and ask counsel to determine applicable law and review cadence.

The owner now intends worldwide reach subject to supported and legally permitted markets. No country list or legal advice has been approved. The [current legal brief](PREMIUM_LEGAL_REVIEW.md) records that scope; the earlier source-only brief is a historical snapshot.

## Explanation skill provenance follow-up

Checked 2026-09-16: Matt Pocock's skill and MIT license at revision `959a8e9f1edc3adbe2f7e3054bb6fbefa6696260`, Copyright Office Circular 33, USPTO's distinction between trademark and copyright, and WIPO's copyright FAQ. The [provenance review](SKILL_PROVENANCE_REVIEW.md) records the links, the conservative attribution decision and the unresolved historical import. Source availability and an MIT notice do not establish worldwide legal clearance.
