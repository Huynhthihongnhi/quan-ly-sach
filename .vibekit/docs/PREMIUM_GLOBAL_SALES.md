# International sales readiness

Reviewed: 2026-09-16. Owner intent: sell internationally, potentially to buyers in any country. Status: preparation only; legal review, seller onboarding and live fulfillment remain pending. This is an operational review and a brief for qualified counsel, not a legal opinion or worldwide clearance.

## Define the reachable market accurately

Use the planning scope "international buyers in supported and legally permitted markets." Do not promise that every person in every country can purchase. Polar's buyer payment restrictions and seller payout eligibility are separate. Vietnam appears in its payout coverage, subject to account eligibility and approval. A payout listing does not approve your entity, product or buyer. Check the current [supported countries policy](https://polar.sh/docs/merchant-of-record/supported-countries) before launch and when adding markets.

The provider's country policy is not an exhaustive legal sanctions analysis. Have counsel determine applicable restrictions for the actual seller, product and recipients. Do not bypass a blocked checkout by relabeling the buyer's country, using another person's account or sending a manual download as an alternative to a prohibited sale.

Polar's merchant-of-record arrangement addresses the payment and international sales-tax responsibilities described in its [MoR documentation](https://polar.sh/docs/merchant-of-record/introduction). Separately settle ownership, license promises, customer support, privacy and the seller's business/accounting duties. A successful checkout is evidence of an order, not evidence that all legal duties have been satisfied.

## Counsel review map

These are material examples for scoping counsel's work. They are not an exhaustive list of countries or a conclusion about which law governs a particular buyer. Until buyer type is established, do not assume every developer is a business customer.

| Market / subject | Issue to resolve before offering there | Primary reference |
| --- | --- | --- |
| Seller in Vietnam | Confirm contracting identity, business status, disclosures and applicable consumer obligations; obtain local tax/accounting advice | [Consumer Protection Law 19/2023/QH15, effective 2024-07-01](https://chinhphu.vn/?docid=208363&pageid=27160) |
| EU consumers | Distance-sale withdrawal information and the conditions for immediate digital supply; preserve mandatory remedies for faulty digital content | [Withdrawal rights](https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm), [digital contract rules](https://commission.europa.eu/topics/business-and-industry/contract-rules/digital-contracts/digital-contract-rules_en) |
| UK consumers | Required pre-sale information, confirmation and express agreement/acknowledgment for immediate digital downloads affecting cancellation rights | [Online and distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling) |
| Australian consumers | Review consumer guarantees when an overseas business directly offers products to Australian consumers | [ACCC online purchases](https://www.accc.gov.au/consumers/buying-products-and-services/buying-online) |
| US recurring sales | Review federal online negative-option requirements and applicable state renewal rules; disclose terms, obtain informed consent and provide cancellation | [FTC ROSCA explanation](https://www.ftc.gov/business-guidance/blog/2018/07/time-rosca-recap-ftc-says-risk-free-trial-was-risky-not-free) |
| Other buyer markets and cross-border data | Determine additional language, local consumer, privacy, data-transfer, tax and restriction requirements before enabling or marketing there | Scope qualified local advice through the [legal brief](PREMIUM_LEGAL_REVIEW.md) |

Avoid a blanket "no refunds for digital products" promise. A qualifying exception to a change-of-mind withdrawal right does not erase all remedies for faulty content. Have counsel draft the checkout wording and retention evidence for the markets actually served.

## Smallest practical launch

Recommend a one-time downloadable offer first, with a named version, one-user license, clear support scope and an explicit update policy. This reduces the number of billing states to operate. It is a recommendation, not a selected price or a change to an existing customer's rights.

The proposed 12-month update offer requires per-customer expiry tracking. A shared file benefit is not that mechanism: adding files grants them to current holders of that benefit. Either implement and verify the access window, operate a documented manual delivery ledger, or choose a simpler offer before making the promise. [Polar file benefit behavior](https://polar.sh/docs/features/benefits/file-downloads).

Use [selling setup](PREMIUM_SELLING.md) for provider operations and [the Vietnamese delivery guide](PREMIUM_DELIVERY.vi.md) for the owner/friend journey. Leave subscriptions and custom CLI activation as later stages until their actual acceptance scenarios pass.

## Required launch record

Keep customer information, account identifiers and legal advice in private business records. Retain only non-sensitive status in this repository.

| Record | Owner | Current state |
| --- | --- | --- |
| Seller identity, business capacity and payout approval | Owner and provider | Unconfirmed |
| Buyer market/type assessment and applicable restrictions | Owner and qualified counsel | Worldwide intent recorded; market review pending |
| License, order, refund, privacy and support terms tied to document digests | Counsel and owner | Pending |
| Ownership and inherited-license evidence | Owner and counsel | Repository notices present; legal verification pending |
| Accepted price, currency, seat and update promise for one offer | Owner | Proposed only |
| Sandbox purchase, 100% gift, failed purchase, refund, access and installation | Owner / implementer | Provider journey not run |
| Per-buyer update cutoff if promised | Owner / implementer | No production automation |
| Reviewed archive and exact distribution approval | Owner | Follow [release gates](PREMIUM_RELEASE.md) |

Recheck provider policies at launch and after a material change. Ask counsel for a suitable review cadence and market additions. This review does not hardcode a permanent country allowlist into the local CLI.
