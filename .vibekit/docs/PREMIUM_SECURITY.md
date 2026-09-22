# Premium security boundary

The optional quality collector executes only the explicitly selected, pinned ESLint installation. It parses bounded source files without loading project config, inline suppressions, hooks or application code. Report inputs are local evidence, not authenticated measurement attestations. The kit does not auto-install the analyzer.

The [selling guide](PREMIUM_SELLING.md) documents future provider-specific signature verification and entitlement reconciliation. The generic HMAC helper in the current domain module is not a production Polar, Stripe or PayPal verifier. No payment credential or live adapter is bundled.

## Threat model

Untrusted inputs include target repositories, manifests, bundles, task records, historical commit messages and external documentation. The CLI treats these as data. It does not execute package lifecycle hooks, task-supplied verification commands, provider hooks or downloaded migrations.

| Boundary | Local control | Remaining limit |
| --- | --- | --- |
| Target files | Canonical root, path validation, symlink/hardlink rejection, expected hashes | A hostile concurrent filesystem actor requires OS enforcement |
| Cooperative writers | Exclusive transaction mutex and persistent receipts | Stale mutex ownership can require manual recovery |
| Approved mutation | Exact plan digest and pre-image checks | Approval authenticates the selected plan through the invoking operator |
| Task closure | Revision, context and evidence-file digests | Log content and observations can still be self-reported |
| Provider policies | Pure fragments with source dates and skipped settings | Runtime enforcement and managed policy need separate verification |
| Artifact delivery | Ed25519, key purpose, size/count/path limits and entitlement binding | Operator keys are not a production registry trust bootstrap |
| Entitlement use | Identity, feature, version, update window, expiry and grace | Offline revocation is bounded by available trusted state |
| Git workflow | Local argv, hooks disabled, sibling path and clean-removal checks | Git executable and filesystem integrity remain host assumptions |

## Data and credentials

[The Premium license](PREMIUM_LICENSE.md) defines permitted use. `license status` reports technical service readiness, and signed artifact verification checks a delivery document. Neither proves that a named user accepted the commercial terms. The local edition has no automatic purchase verification or activation service.

The local CLI has no telemetry and makes no entitlement or registry network requests. Normal reports redact common credential formats, email addresses and the local home prefix. Redaction is defense in depth, not a universal secret detector. Keep credentials out of inputs intended for reports.

Production activation must use an OS credential store. Signing keys and webhook secrets belong in a separately controlled server or KMS. The included entitlement event reducer and signature interfaces are domain building blocks, not a deployed service, database, payment integration or rate limiter.

## Release gates

- Platform CI on the supported Node and operating-system matrix.
- Live provider startup/schema checks against supported versions.
- Durable service storage, activation/device flows, request limits and revocation delivery.
- Production release-key custody, rotation, retirement and compromise recovery exercises.
- Commercial license/privacy review and independent security review.
- An explicit decision to publish a specific package/artifact and enable any live service.

Local tests and the AgentShield repository probe do not substitute for these gates. The full Proofline seal is not eligible when enforced reviewer/oracle isolation is unavailable.
