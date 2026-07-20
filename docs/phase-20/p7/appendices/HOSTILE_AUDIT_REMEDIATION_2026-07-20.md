# Hostile audit remediation — 2026-07-20

Closes findings from the Principal hostile retrospective (`PREV-AUD-001`…`016` / TODO-001…012).

## Logic

| ID | Change | Runtime proof |
| -- | ------ | ------------- |
| TODO-001 | JWT-only HTTP → Prisma booking write under `NODE_ENV=production` | `test:booking-http-postgres-jwt-production` |
| TODO-002/011 | ENABLE+FORCE RLS on previously open tenant tables; identity OTP/users via admin where needed | migration + `test:tenant-rls-unprotected-tables` |
| TODO-003 | Boot probe = full tenant-RLS inventory; optional `APP_RUNTIME_PROFILE=prodlike` | unit + integrity probe |
| TODO-004 | Platform ops: no default bearer; empty phone whitelist fail-closed in production/prodlike | unit specs |
| TODO-005 | Live `main` protection | **BLOCKED** until `gh auth` — deploy wait script remains |
| TODO-006 | VPS outbox-relay systemd unit + approve→processed CI slice | unit + optional PG effect |
| TODO-007 | Parallel HTTP guest duplicate race | PG HTTP concurrency job |
| TODO-008 | Finance booking port: no `getBookingsRepository()` in finance runtime | depcruise + hygiene |
| TODO-009 | Receipt authz HTTP + sess_ver revoke JWT E2E | JWT production suite |
| TODO-010 | Rollback smoke hint includes dump path; `CODE_ONLY` requires `I_ACCEPT_SCHEMA_FORWARD=1` | script contract |
| TODO-011 | `resolveWorkspaceTypeForTenant` fail-closed (no `starter` fallback) | unit |
| TODO-012 | Demote grep-as-cert; plan progress requires runtime evidence | doc + CI scripts |

## RLS policy model

- **Tenant-scoped tables:** `tenant_id = current_setting('app.current_tenant_id', true)::uuid`
- **`users` (no tenant column):** SELECT only when membership exists for current GUC tenant; INSERT/UPDATE/DELETE only via `DATABASE_URL_ADMIN` (identity admin client)
- **`mobile_otp_challenges`:** no app_cloud policies (deny); OTP via admin client
- **Platform catalog / domains:** already admin-client; FORCE RLS deny for `app_cloud`

## Diagram

```text
HTTP JWT (prod) → TenantKernel → requireOperatorSession(sess_ver)
  → hydrateMembership(user_tenants RLS)
  → BookingsService → PrismaBookingsRepository → app_cloud + GUC
```

## Residual closure (post ad59bd1e)

| Gap | Closure |
| --- | ------- |
| Outbox effect SLA | `test:booking-approve-outbox-relay-effect` — approve HTTP → `processOutboxRelayForTenantOnce` → `status=done` |
| Receipt JWT authz | Extend JWT production suite: member A cannot put proof for B's booking (put spy count 0) |
| Branch protection | CI step `ops:branch-protection:verify` on booking gate (GITHUB_TOKEN); local script already fail-closed without `gh` |

