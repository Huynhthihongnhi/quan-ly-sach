# Premium schemas

These JSON Schemas describe the source catalog and task brief. The dependency-free runtime validators add graph, version, scope, freshness and evidence constraints that ordinary structural schema validation cannot prove.

- `skill-manifest.schema.json`: source catalog version 3. Version 2 migration is a read-only compatibility path in `premium/catalog.mjs`.
- `task-brief.schema.json`: input to `task start`. Runtime task state adds identity, revision, context, decisions, tickets, evidence and history.

Signed releases and leases use exact-field allowlists in `premium/artifacts.mjs`. Unknown fields or algorithms fail closed. The envelope is `{payload, signature}`, and `signature` contains `algorithm`, `keyId` and canonical base64url `value`.

The `mvck-release-v1` payload binds schema version, skill ID/version/channel, product, feature, license, publication date, minimum CLI, bundle digest and exact file path/hash/size records. `mvck-file-bundle-v1` contains only canonical base64 regular files. A lease binds issuer, audience, subject, lease ID, installation, product, features, allowed versions, update window, issue/not-before/expiry/grace times and active status.

See [architecture](../PREMIUM_ARCHITECTURE.md) for the signature byte encoding and [security](../PREMIUM_SECURITY.md) for trust limits. No schema or signature grants authority to execute a hook, modify an arbitrary path or publish a release.
