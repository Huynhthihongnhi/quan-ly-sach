# Friend coupons and gifts

These are proposed examples, not active codes. Create real discounts in your payment dashboard. Use one fresh code per friend when the offer is private; replace `EXAMPLE` with a random suffix before creation.

Follow [the owner-and-friend handoff](PREMIUM_FRIEND_HANDOFF.md) for generating a candidate code, registering it, delivering the kit and installing or upgrading the friend's project. A coupon discounts checkout; the current CLI has no coupon redemption or live activation command.

## Suggested offers

| Example code | Applies to | Discount | Duration | Limit | Redeem by |
| --- | --- | --- | --- | --- | --- |
| `FRIEND50-EXAMPLE` | One-time Premium Pack | 50% | One purchase | 1 total redemption | 7 days after creation |
| `FRIEND25-EXAMPLE` | Premium Monthly | 25% | First billing period only | 1 total redemption | 7 days after creation |
| `FRIEND20-EXAMPLE` | Premium Annual | 20% | First annual invoice only | 1 total redemption | 7 days after creation |
| `GIFT100-EXAMPLE` | One-time Premium Pack | 100% | One purchase | 1 total redemption | 7 days after creation |

Recommended default: `FRIEND50` for the one-time pack, with the same update rights as a normal purchase. A coupon changes price. It must not silently change the license, seats or update duration.

The customer receives one named-user seat under [Bui Van Giang's Premium terms](PREMIUM_LICENSE.md). A free checkout can issue the same license as a paid order. A code alone grants no kit access, and customers cannot create gift rights by forwarding their own download. A manual gift must come from Bui Van Giang or an authorized distributor.

The redemption deadline is different from discount duration and entitlement expiry. For example, a friend has 7 days to redeem `GIFT100`; if the owner selects and implements the proposed 12-month update offer, its update clock starts at purchase. That proposal is not a configured entitlement today. The monthly example returns to the displayed normal price at its second billing period. Do not select a forever discount unless indefinite discounted renewals are intentional.

## Create it in Polar

1. Open **Discounts** and create a named percentage discount with the actual code.
2. Select **Once** for the examples. Restrict it to the intended product, set start/end timestamps, maximum redemptions to 1 and per-customer maximum to 1.
3. Test checkout, delivery and normal-price renewal in sandbox. Check that the summary shows the offer you intend.
4. Create the production discount separately and share its checkout link/code directly with your friend.

Polar supports fixed/percentage discounts, date/product restrictions and recurring duration settings. An unrestricted product discount can apply to future products too. Codes can be prefilled or applied through checkout links, but a shared link is not an identity restriction. Full refunds can restore a customer's redemption slot, so reconcile your private gift policy separately. [Polar discounts](https://polar.sh/docs/features/discounts).

If only a named person should receive access, bind the offer to their authenticated customer record through your service, or verify it through an explicit manual gift process. A one-use code can still be redeemed by whoever receives it first.

## Stripe later

Create a coupon for the discount and a promotion code for the friend-facing code. Restrict the eligible product, maximum uses, expiry and customer where applicable. Enable code entry or apply the approved discount when creating Checkout. Test a full discount through Checkout's no-cost order flow. Do not wait for a PaymentIntent that a zero-cost order may not create. [Stripe coupons](https://docs.stripe.com/billing/subscriptions/coupons), [no-cost orders](https://docs.stripe.com/payments/checkout/no-cost-orders).

## PayPal later

Use the service's own coupon table for one-time Orders discounts. Validate code, product, authenticated customer, expiry and usage on the server. Reserve one use atomically; calculate the approved amount; create and capture the PayPal order; mark the redemption only once after confirmed capture. A trusted internal gift grant handles 100% gifts. Subscription promotions use their billing-plan terms and need separate testing. See [the PayPal integration section](PREMIUM_SELLING.md).

## Keep a small private record

Store the provider discount ID, internal offer, percentage, duration, UTC expiry, redemption cap and redemption status. Keep the actual private code and customer reference in a restricted business system, outside this repository. Disable an unredeemed leaked code and create a new one. A redeemed discount's existing subscription terms need separate handling.

For manual gifts, record who approved the grant, the internal customer, reason, offer, start, expiry and a unique grant ID. Use the same entitlement rules as a purchase. Do not share your own provider API credential, signing key or customer license key.

Copy-ready message after the real discount is created:

```text
Here is your private Premium Pack code: [actual code]
Checkout: [actual production checkout link]
It gives [discount] on one purchase and expires on [date and time, timezone].
The pack includes [exact usage and update rights].
Please keep the code private. It can be redeemed once.
```

For a subscription, also state the first charge, discount end, regular renewal price and cancellation link. Test the full customer journey before sharing it.
