# Runbook IAM bootstrap va audit

Tai lieu van hanh cho admin dau tien, bao ve admin cuoi va truy van audit. Khong co endpoint HTTP bootstrap public.

## Bootstrap admin dau tien

1. Chay migration schema identity/access toi version moi nhat:

```sh
cd BE
npm run db:up -- --to 4
```

2. Dat bien moi truong bootstrap (khong commit gia tri that):

```sh
export BOOTSTRAP_ADMIN_EMAIL='admin@local.test'
export BOOTSTRAP_ADMIN_PASSWORD='change-me-12chars'
export BOOTSTRAP_ADMIN_DISPLAY_NAME='System Administrator'
```

3. Chay CLI (mot lan, qua Nest application context, khong qua HTTP):

```sh
npm run bootstrap:admin
```

Ket qua JSON gom `created` va `userId`. Lan chay sau tra `created: false` va **khong doi password** neu da co admin active.

## Kiem tra nhanh sau bootstrap

- Co dung mot user active co role `admin`.
- `user_roles.assigned_by` cua admin la chinh user do.
- Co ban ghi audit `iam.bootstrap.admin` voi `requestId`, khong co password trong `details`.
- Khong ton tai route `POST /api/v1/bootstrap/*`.

## Bao ve admin cuoi

- Block/archive user hoac go role admin phai qua `IamPolicyService` voi khoa `iam_policy_locks`.
- Thieu row khoa: fail closed (`iam_policy_lock_missing`).
- Hai thao tac dong thoi khong duoc de mat het admin active; kiem bang `npm run test:integration -- --testPathPatterns=iam-audit` va `CONCURRENCY_TESTS=1 npm run test:concurrency`.

## Truy van audit

Endpoint: `GET /api/v1/audit-events` (permission `audit.read`).

Query ho tro: `actorId`, `action`, `from`, `to` (ISO 8601), `page`, `pageSize`.

Response loc key nhay cam (`password`, `token`, `session`, ...). Khong co API sua/xoa audit cho runtime user.

## Credential va log

- Khong in password, session token, reset token ra stdout/stderr.
- Bootstrap CLI chi in JSON ket qua (`created`, `userId`).
- Runtime DB user chi append audit; doc qua API co quyen.
