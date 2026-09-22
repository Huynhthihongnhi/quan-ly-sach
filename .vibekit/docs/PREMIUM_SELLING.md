# Selling MVCK Premium from Vietnam

Checked: 2026-09-15. Seller country: Vietnam. Desired offers: one-time purchase and subscription. This is an implementation guide, not a deployed payment integration. Recheck country, product rules, fees and SDK versions before going live.

**Before accepting paid orders:** obtain qualified counsel's review of the exact license and sales terms, resolve its conditions, and approve the final archive. Review is currently pending. Use the [counsel brief](PREMIUM_LEGAL_REVIEW.md) and [0.6.3 release record](PREMIUM_RELEASE.md).

## International scope and first offer

The owner intends international sales. Use [the market review](PREMIUM_GLOBAL_SALES.md) to distinguish permitted buyer markets from seller payout eligibility. No worldwide legal clearance is recorded.

Recommend starting with one one-time offer and an explicit delivered-version/update promise. The offers below remain proposals. Do not advertise a 12-month update cutoff until per-customer access tracking is operated and verified. Subscriptions can follow after recurring lifecycle tests pass. For a plain-language walkthrough, use [the Vietnamese delivery guide](PREMIUM_DELIVERY.vi.md).

## Recommended provider

| Option | What it does | Cost | Risk | Recommended |
| --- | --- | --- | --- | --- |
| Polar | Hosted checkout, merchant-of-record sales and digital delivery | Starter: 5% + USD 0.50 base transaction fee; other fees may apply | Account/product review and payout onboarding | Yes |
| Direct Stripe Checkout | Payment processing and Billing with your own delivery backend | Regional processing, Billing/Tax and backend operations | Vietnam is absent from the direct merchant availability list | No |
| PayPal Business | PayPal checkout and eligible recurring billing | Vietnam merchant, cross-border/FX and backend costs | More delivery and billing reconciliation work | No |

**Recommendation:** start with Polar because it lists Vietnam for seller payouts and fits downloadable software. Availability is subject to successful onboarding and product approval. Polar's Connect payout support does not mean a Vietnam business can open a direct Stripe Payments account. [Polar countries](https://polar.sh/docs/merchant-of-record/supported-countries), [Stripe availability](https://stripe.com/global), [PayPal Vietnam Business](https://www.paypal.com/vn/business).

Polar acts as merchant of record: it handles buyer-facing payment and indirect-tax responsibilities described by its service. Direct Stripe Checkout and standard PayPal are different arrangements; plan your own tax, refund and operational process. Stripe's separate Managed Payments offering has separate eligibility and terms. For Vietnam bookkeeping and income/business obligations, confirm your setup with a local accountant; a merchant of record does not settle every seller obligation. [Polar MoR](https://polar.sh/docs/merchant-of-record/introduction), [Stripe products](https://stripe.com/global).

Use the current fee schedule when setting margins. Polar's Starter base is 5% + USD 0.50; its docs also list an international-card surcharge, other plans and possible payout-related costs. Do not interpret the base rate as your net payout. Avoid upgrading solely from the published breakeven figure without considering your actual order size and customer mix. [Polar fees](https://polar.sh/docs/merchant-of-record/fees). For PayPal, use [Vietnam merchant fees](https://www.paypal.com/vn/business/paypal-business-fees); for a future eligible Stripe entity, use its local pricing page.

Polar permits software and digital assets, but excludes human-services businesses and reserves product review rights. Present the actual software/download value. Do not package a support-only or consulting service as software to evade those rules. [Acceptable use](https://polar.sh/legal/acceptable-use-policy).

## Define both offers clearly

The following are proposed product contracts. Choose prices before publishing checkout links.

| Offer | Payment | Proposed entitlement |
| --- | --- | --- |
| Premium Pack | One time | Keep delivered versions; new releases for 12 months from purchase |
| Premium Monthly | Recurs monthly | New releases and hosted benefits through the paid period |
| Premium Annual | Recurs yearly | Same recurring benefits, billed yearly |

Use distinct internal offer IDs and map each to the provider's exact product and price IDs. Never accept a product, amount or entitlement duration supplied by the browser as authoritative.

Explain renewal, cancellation, refunds, device/seat limits and what remains usable after expiry before purchase. Cancellation normally prevents the next renewal; it should not erase an already paid period. Downloaded files cannot be remotely recalled. The kit preserves installed files and blocks only new entitled delivery when a lease expires.

For the one-time offer, distinguish `updatesUntil` from ongoing use of downloaded versions. For subscriptions, track `paidThrough`, cancellation and the approved grace policy. A short signed lease expiry is a cache/security deadline, not a new charge or automatic loss of perpetual usage rights.

Original Premium work uses Bui Van Giang's proprietary single-user license, with personal and commercial/client use, private modifications and no kit sharing or resale. Inherited MIT material and earlier MIT copies retain their rights. Show [the license and component scope](PREMIUM_LICENSE.md) before checkout, attach the terms to the order and state the update period. Keep the Premium distribution private and keep signing keys out of every customer archive.

## Phase 1: Polar checkout and hosted delivery

1. Open a Polar organization using your actual Vietnam seller details. Complete identity, business and payout onboarding. Describe the kit truthfully for product review.
2. Use the separate [sandbox environment](https://polar.sh/docs/integrate/sandbox). Create test offers for the pack, monthly and annual subscription. Set your intended currency, renewal wording, cancellation and refund terms.
3. Create reviewed, versioned release archives and attach [File Download benefits](https://polar.sh/docs/features/benefits/file-downloads). Verify the customer portal grants access to the intended offer. Hosted download fulfillment can work before a custom MVCK activation service exists.
4. Create the discounts in [the coupon guide](PREMIUM_COUPONS.md). Exercise checkout and customer access for paid and free orders.
5. Confirm period-end cancellation, expiry, refunds and renewal access using sandbox customers. A forever-shared file benefit does not automatically implement a per-buyer 12-month update window. For that offer, use controlled release access with the entitlement service below, or an explicit manual process until automated and verified. Do not promise an unimplemented cutoff.
6. After sandbox acceptance, create separate production products, prices, benefits and checkout links. Production and sandbox IDs and credentials must never be mixed. Enable real sales only after reviewing the actual offer and delivery path.

Polar can also issue [License Key benefits](https://polar.sh/docs/features/benefits/license-keys) with expiry and activation settings. A Polar key is not an MVCK Ed25519-signed entitlement. The current CLI cannot consume a Polar checkout URL or key as `artifact add` input. An authenticated service must validate the key/customer, product, benefit and update window before issuing MVCK delivery documents.

## Phase 2: add the entitlement service when needed

An entitlement is the server's record of what a buyer may access. Keep one internal customer and offer model across providers. This proposed service flow is not present as an HTTP server in the kit:

```text
Hosted checkout
  -> provider-specific verified webhook
  -> durable event inbox
  -> fetch current provider state and match the offer
  -> serialized entitlement update
  -> durable delivery job
  -> private signer / download service
  -> authenticated customer receives a signed release and lease
  -> local MVCK artifact verification
```

Store a unique inbox key `(provider, account, environment, eventId)`. Acknowledge only after durable receipt. Retrying the same event must not duplicate access, coupon redemptions or delivery. Serialize updates for each entitlement and reconcile with current provider state so late events cannot reactivate a refund or expired subscription. Use periodic reconciliation to recover missed webhooks.

Bind orders to authenticated customers and server-created checkout sessions. Verify product, amount, currency, seller account and payment state. Zero-cost orders require their own valid entitlement path; a nonexistent payment object is not automatically fraud or failure. Browser success redirects alone never grant access.

Keep credentials and signing material server-side, separate between environments. A provider API credential, webhook secret, customer license key and private signing key have different purposes. None belongs in a client bundle, public package, task record or log. Store only redacted references in kit evidence.

### How this maps to the current code

- `premium/entitlements.mjs` contains a local reducer and test primitives, not a production webhook endpoint or persistent database.
- `verifyWebhookHmac` is a generic fixture/helper protocol. **Do not use it to verify Polar, Stripe or PayPal webhooks.** Their signature formats and replay checks differ.
- The reducer's `sequence` must be an internal monotonic revision assigned during a serialized database update after reconciliation. Do not use webhook arrival order, a provider timestamp or a fabricated provider sequence.
- The present reducer covers a limited set of subscription/refund/update events. A production adapter still needs initial one-time purchase and gift grants, grace policy, chargeback handling, persistence and provider-specific tests. An active/free trial must follow the exact advertised product policy.
- `artifacts.mjs` validates signed delivery and `delivery.mjs` plans local installation. The production service must use controlled trust anchors and signing infrastructure. See [security and release gates](PREMIUM_SECURITY.md).

### Polar adapter

Use the official SDK's webhook validation helper with the untouched request body, headers and configured endpoint secret. Its signing format changed for secrets created on or after **2026-09-08**; choose and pin a current SDK that supports your secret format, then verify actual sandbox deliveries. Do not copy a generic HMAC snippet. [Polar webhook validation](https://polar.sh/docs/integrate/webhooks/delivery).

Use `order.paid` and the relevant customer/subscription/benefit changes as reconciliation triggers. Fetch [Customer State](https://polar.sh/docs/integrate/customer-state) and the corresponding order where required. Check your specific offer and benefits; a canceled subscription may still have a paid period. Validate refunds and final revocation with the [event catalog](https://polar.sh/docs/integrate/webhooks/events).

### Future Stripe adapter

First establish legitimate direct-merchant eligibility for the actual seller entity. Do not select a false country. Only then create separate test/live products and prices, hosted Checkout sessions (`payment` or `subscription`) and the customer portal.

Use Stripe's SDK webhook verification with raw request bytes and `Stripe-Signature`. Handle duplicate and unordered events. Grant only after confirmed payment or a valid no-payment-required order; complete asynchronous payments through their final events. Reconcile recurring access from subscription and invoice state, including paid invoices, failures, cancellation, refunds and disputes. [Stripe webhooks](https://docs.stripe.com/webhooks), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [no-cost orders](https://docs.stripe.com/payments/checkout/no-cost-orders).

A Stripe coupon defines the discount; a promotion code is the code your friend enters. Configure product, customer, expiry and redemption restrictions as applicable, then enable code entry in Checkout. Test first-payment versus recurring duration. [Stripe discounts](https://docs.stripe.com/billing/subscriptions/coupons).

### Future PayPal adapter

Use your Vietnam Business account and confirm the intended Checkout/Subscriptions features are enabled. Create an app in the developer dashboard and sandbox buyer/seller accounts. Use a server-created [Orders v2](https://developer.paypal.com/api/orders/v2) order for one-time purchases, then capture and confirm the completed capture. An approved order alone is not a completed payment.

For recurring offers, use product/plan/subscription APIs and reconcile actual payments, including `PAYMENT.SALE.COMPLETED`, failures, refunds, suspension and cancellation. An activated subscription alone does not establish a paid first period when trials exist. [Subscription events](https://developer.paypal.com/subscriptions/webhooks/).

Verify webhooks through PayPal's `verify-webhook-signature` API using the transmission headers, configured webhook ID and event, and require `SUCCESS`. Use your configured PayPal API endpoint, not a URL supplied by the event. The simulator's mock events cannot be validated by this postback API; use real sandbox transactions for that proof. [PayPal verification](https://developer.paypal.com/api/rest/webhooks/rest/).

For one-time friend discounts, validate the coupon and calculate the order on your server before creation. Store currency amounts without binary floating-point rounding, preserve the amount breakdown and bind the reserved discount to the order. Settle redemption once capture succeeds; release reservations on expiry/failure. Do not invent a universal PayPal promo-code endpoint. A 100% gift can use an authenticated internal grant without creating a zero-value PayPal charge. Introductory subscription pricing needs the appropriate billing-cycle setup and buyer consent, not a one-time Orders discount.

## Acceptance before real money

Record sandbox order IDs, redacted events and observed access for these scenarios:

| Scenario | Required result |
| --- | --- |
| One-time paid purchase | Correct buyer, offer, archive and update window |
| Monthly and annual renewals | Extend only the paid period, once |
| Friend code and 100% gift | Correct price and access; no dependency on a positive charge |
| Expired, reused or wrong-product code | No discount or unauthorized grant |
| Invalid signature or wrong environment/account | Rejected before entitlement changes |
| Duplicate, delayed or reordered webhook | No duplicate grant or stale reactivation |
| Worker failure after inbox commit | Retry finishes once without losing the event |
| Failed payment and later recovery | Apply the published grace and recovery policy |
| Cancellation and period expiry | Preserve the paid term; stop future entitled delivery at the right time |
| Full/partial refund and dispute | Apply the documented policy, preserve history, reconcile access |
| Update window expiry | Installed versions remain; newer releases follow the offer contract |

The kit's local reducer tests do not replace this matrix. Keep live activation unconfigured until the selected adapter, persistence, signer, customer authentication and delivery path have passed it.
