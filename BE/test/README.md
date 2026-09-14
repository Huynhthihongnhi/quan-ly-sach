# Test layout (S0-04)

| Layer | Path | Command |
| --- | --- | --- |
| Unit | `test/unit/` | `npm run test:unit` |
| Integration | `test/integration/` | `npm run test:integration` (Docker MySQL) |
| Contract | `test/contract/` | `npm run test:contract` |
| Concurrency | `test/concurrency/` | `npm run test:concurrency` (Docker MySQL) |

Shared utilities live in `test/support/`:

- `database-test-config.ts`: isolated test DB `quan_ly_sach_test`
- `setup-orm-probe-schema.ts`: probe DDL via migration user
- `http-harness.ts`: allow/deny HTTP checks for route policy
- `fake-clock.ts`: deterministic time for unit tests
- `dual-connection.ts`: two runtime connections for race probes

ORM probe tables are created only in the test database by `test/support/sql/orm-probe-up.sql`. They are not part of application migrations.

Fail-fast local check without Docker:

```sh
npm run validate
```

Full MySQL-backed check:

```sh
npm run docker:up
npm run test:integration
npm run test:concurrency
```
