# Phase 9 — Environment & runtime matrix

```yaml
matrix_version: "2026-06-08-v2"
extends: ../../phase-8/appendices/env-runtime-matrix.md
authority: phase-9-agent-router.md · IDENTITY-PORT-SCOPE.md · CASL-OPERATOR-SPEC.md
subphases: ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8"]
req_ids: [REQ-P9-010, REQ-P9-011, REQ-P9-080]
```

## Environment profiles

| Profile         | Postgres                     | Redis                     | OTP                        | Session                    | Dev bearer                    |
| --------------- | ---------------------------- | ------------------------- | -------------------------- | -------------------------- | ----------------------------- |
| **Development** | Optional static tenants      | Optional                  | `OTP_FIXTURE_CODE` allowed | Cookie + dev session flags | `ALLOW_DEV_WEB_SESSION` gated |
| **Staging**     | Required + migration 005/006 | Required for OTP throttle | Real SMS stub              | HttpOnly cookie            | **Forbidden**                 |
| **Production**  | Required + RLS               | Required                  | Real SMS provider          | HttpOnly Secure            | **Forbidden**                 |

**Boot order:** `assertAuthEnvironmentIntegrity` → identity routes (9.1) → `(app)/` shell (9.2+) → workspace plugin resolve.

---

## Variable matrix (9.1+)

| Variable                               | Type         | Default (dev)         | Consumer                    | Failure mode                 |
| -------------------------------------- | ------------ | --------------------- | --------------------------- | ---------------------------- |
| `NODE_ENV`                             | enum         | development           | auth-env.ts                 | Wrong auth path → boot throw |
| `DATABASE_URL`                         | postgres URI | dev DB                | Prisma · UserTenant hydrate | 503 login                    |
| `REDIS_URL`                            | redis URI    | unset                 | OTP rate limit              | Prod: boot throw if required |
| `SESSION_SECRET`                       | string ≥ 32  | dev only              | session sign                | Sessions invalid             |
| `OTP_FIXTURE_CODE`                     | string       | unset                 | test + dev inject           | **Prod: boot throw if set**  |
| `ALLOW_DEV_WEB_SESSION`                | boolean      | false                 | web session bypass          | **Prod: boot throw if true** |
| `RESEND_API_KEY`                       | string       | unset                 | OTP SMS (optional P1)       | Log-only OTP in dev          |
| `IDENTITY_PRODUCTION_ENABLED`          | boolean      | false until 9.1 lands | auth routes gate            | 503 when false in staging    |
| `AUTH_ALLOW_DEV_STATIC_OTP`            | boolean      | true (dev)            | skip challenge row          | prod: false                  |
| `OTP_FIXTURE_CODE`                     | string       | unset                 | deterministic challenge code (non-prod tests) | **Prod: boot throw if set** |
| `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN`    | string       | host-only dev         | cookie Domain attr          | prod: tenant root            |
| `NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE` | enum         | lax (dev)             | cookie SameSite             | prod: none + Secure          |
| `NEXT_PUBLIC_TENANT_ROOT_DOMAIN`       | string       | unset                 | prod cookie fallback        | —                            |
| `AUTH_JWT_PUBLIC_KEY`                  | PEM          | `bootstrap:dev-jwt`   | RS256 verify                | boot fail if missing prod    |
| `AUTH_JWT_PRIVATE_KEY`                 | PEM          | same script           | RS256 sign                  | OTP login 500 if missing     |
| `AUTH_JWT_ISSUER` / `AUTH_JWT_AUDIENCE` | string    | `tour-ops` / `tour-ops-api` | JWT claims            | verify rejects if mismatch   |

### Dev login fixture (SMK-P9-01)

| Field  | Value                                          |
| ------ | ---------------------------------------------- |
| Host   | `denali.admin.localhost:3000` (canonical; `denali.localhost:3000` on web 308 → admin) |
| Mobile | `09174070937` (Denali / operator smoke seed owner) |
| OTP    | `1234` (when `AUTH_ALLOW_DEV_STATIC_OTP=true`) |

Web login form (dev): `NEXT_PUBLIC_DEV_LOGIN_PHONE` / `NEXT_PUBLIC_DEV_LOGIN_OTP` must match this fixture.
Default fallback in `apps/web/app/auth/login/login-form.tsx` is the same mobile; placeholder copy in `messages/*/auth.json` → `phonePlaceholder`.
Source of truth for the seed mobile: `apps/api/scripts/seed-denali-operator-identity.ts` (`DENALI_DEV_OWNER_MOBILE`) and in-memory `DEFAULT_OPERATOR_SMOKE_OWNER_MOBILE` — override only via `OPERATOR_OWNER_MOBILE` on the API **and** matching `NEXT_PUBLIC_DEV_LOGIN_PHONE` on web.

---

## Operator E2E (9.8)

| Variable                      | Purpose            |
| ----------------------------- | ------------------ |
| `OPERATOR_SMOKE_TENANT_HOST`  | `denali.localhost` |
| `OPERATOR_SMOKE_OWNER_MOBILE` | Seed mobile        |
| `PLAYWRIGHT_BASE_URL`         | Web origin         |

---

## Fail-closed (MAP §12.4)

Production deploy blocked when:

- `OTP_FIXTURE_CODE` set
- `ALLOW_DEV_WEB_SESSION=true`
- Migration `005_identity_production_delta.sql` not applied
- JWT role trusted without DB hydrate (code review — DELTA-NP-04)
