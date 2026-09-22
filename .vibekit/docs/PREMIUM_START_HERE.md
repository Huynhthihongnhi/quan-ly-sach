# Start here: use and sell your Premium kit

Tiếng Việt: [Tặng bạn bè, coupon, thanh toán và cài đặt](PREMIUM_DELIVERY.vi.md). Documentation status: [current guides and historical records](DOCUMENTATION_MAP.md).

This is the private, unpublished 0.6.3 review candidate. Authorized users can use its workflows now. Legal review and commercial approval are pending; see the [release record](PREMIUM_RELEASE.md). Payment accounts, real coupons, hosted checkout and live CLI activation are not configured by this repository.

For the complete owner-and-friend journey, start with [Send, install and upgrade](PREMIUM_FRIEND_HANDOFF.md). It includes a candidate coupon generator, dashboard setup, archive checks, fresh installation, OSS-to-Premium upgrades and later updates.

## 1. Use the kit in a project

From this kit checkout:

```sh
node bin/mvck.js skill list
node bin/mvck.js skill add closed-loop-engineering --target /absolute/path/to/project --provider codex --json
```

The second command shows a plan and writes nothing. Review its paths and conflicts. In an interactive terminal, apply and approve the displayed plan:

```sh
node bin/mvck.js skill add closed-loop-engineering --target /absolute/path/to/project --provider codex --apply
```

For automation, use `--apply --accept-plan-sha256 <digest-from-preview>`. Repeat for `clean-delivery` if you need its behavior and cleanup gates. Replace `codex` with the supported provider you actually use. Standalone skill installation copies the skill, not the whole CLI runtime; continue using this reviewed checkout's CLI for its commands.

For whole-kit scaffolding, follow [installation](INSTALL.md). Review the full install plan and complete the target project's first-time initialization. Existing initialized projects need their actual `backbone.yml`, not this kit repository's configuration.

## 2. Give the agent one clear task

Paste this into your coding agent, replacing the bracketed details:

```text
Use closed-loop-engineering for [observable outcome].
Read AGENTS.md and backbone.yml. Inspect the existing implementation first.
Edit only [paths]. Preserve [existing behavior].
Acceptance: [two or three observable requirements].
Run [the project's validation command].
Review changed functions for complexity, duplication and unnecessary abstractions.
Use the approved complexity analyzer if available; report missing measurements honestly.
Finish with the result, evidence, remaining risks, Done and Next.
```

For a tiny fix, state the outcome and relevant check directly. Task files and multiple stages are useful when the work needs them. See [the detailed command guide](PREMIUM_GUIDE.md) for task creation, evidence and closure.

## 3. Keep repeated changes readable

Use [code quality and cyclomatic complexity](PREMIUM_QUALITY.md) to collect a baseline, measure the final source and inspect hotspots. Keep behavior tests and maintainability review as separate checks. Fix one meaningful structural problem at a time.

## 4. Prepare sales from Vietnam

Start with [the selling guide](PREMIUM_SELLING.md). It covers Polar first, both one-time and subscription offers, and future Stripe or PayPal adapters. The recommended first delivery uses Polar's hosted checkout and customer download benefits after account approval and sandbox verification.

Original Premium work uses Bui Van Giang's proprietary single-user license. Inherited MIT material keeps its existing rights. Read [the license guide](PREMIUM_LICENSE.md), show the terms before purchase and state the delivered version and update period. A customer should know exactly what the purchase adds.

## 5. Give a friend a discount or gift

Follow [the coupon guide](PREMIUM_COUPONS.md). It includes example codes and exact limits to configure. Examples in this repository are not active coupons. Create them in your provider dashboard only when you intend to share them.

A direct manual gift works today: Bui Van Giang can authorize a named recipient in writing and send a reviewed archive with the [copy-ready friend message](PREMIUM_FRIEND_HANDOFF.md#7-owner-copy-this-message-after-access-is-ready). Bundled workflows need no technical activation; Premium use still requires a purchase or written grant. `license status` reports service readiness; it does not redeem a coupon.

## 6. Verify before distributing a release

```sh
npm test
npm run security:probe
npm run pack:dry-run
git diff --check
```

The optional ESLint integration check is documented separately. Local tests do not certify a live payment service. Complete the provider sandbox scenarios in the selling guide before enabling real purchases. Follow [the release gates](PREMIUM_RELEASE.md) for distribution; maintainers also use `.vibekit/init/PUSH_TO_GITHUB.md` in the source checkout.
