# Identity port scope — Phase 9.1 delta

```yaml
scope_version: "2026-06-09-v3"
decision: [DEC-P9-003, DEC-P9-012]
delta_refs: [DELTA-NP-01, DELTA-NP-02, DELTA-NP-04]
prisma_schema: apps/api/prisma/schema.prisma
migration_target: infra/sql/010_identity_production_delta.sql
prisma_migration: apps/api/prisma/migrations/20260609100000_identity_production_delta
migration_note: "010 — trunk already uses 005_tenant_routes.sql (Phase 7.7); identity delta renumbered per infra/sql/README.md"
identity_driver: "follows STORAGE_DRIVER memory|prisma — see create-identity-repository.ts"
login_flow: OPERATOR-LOGIN-FLOW.md
web_bff: identity-web-bff-addendum.md
```

## Intent

Close **P0 identity gaps** so `(app)/` routes authenticate real operators with **legacy-equivalent OTP login flow** — not dev bearer stubs alone.

**Binding:** Membership checks hydrate from PostgreSQL under RLS. JWT is **stateless**; invalidation via `UserTenant.sessionVersion` (DEC-P9-012).

---

## Prisma models (Phase 9.1)

| Model                | Purpose                                           | Legacy entity                    |
| -------------------- | ------------------------------------------------- | -------------------------------- |
| `User`               | Global user identity (mobile/email)               | `user.entity.ts`                 |
| `UserTenant`         | Membership + role + **sessionVersion** per tenant | `user-tenant.entity.ts`          |
| `MobileOtpChallenge` | OTP challenge store (single-use, TTL 5m)          | `mobile-otp-challenge.entity.ts` |
| `OperatorPendingInvite` | Pending workspace invite (9.1 DDL · 9.4 UX)     | legacy invite flow               |

### SQL delta (`010_identity_production_delta.sql`)

| Table                     | RLS   | Notes                                                                 |
| ------------------------- | ----- | --------------------------------------------------------------------- |
| `users`                   | No    | Global identity · unique `mobile`                                     |
| `user_tenants`            | Yes   | Compound PK `(user_id, tenant_id)` · `session_version` for JWT revoke |
| `mobile_otp_challenges`   | No    | Pre-login · TTL enforced in service layer · `code_hash` scrypt (1C.2) |
| `operator_pending_invites`| No    | App-layer tenant checks · unique `invite_token`                       |

**Repository wiring:** `PrismaIdentityRepository` when `STORAGE_DRIVER=prisma` + `DATABASE_URL`; `InMemoryIdentityRepository` otherwise (tests/smoke). Interface is **async** — handlers `await` hydrate/OTP/users paths.

### Forbidden in 9.1

| Pattern                                        | Reason                                    |
| ---------------------------------------------- | ----------------------------------------- |
| `UserSession` server-side session table as SoT | Legacy uses JWT + `sess_ver` — DEC-P9-012 |
| TypeORM entities                               | Prisma only — DEC-P9-003                  |

### `UserTenant` fields (minimum)

| Column                          | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `role`                          | `owner` \| `admin` \| `member` \| `viewer` — **DEC-P9-019** (amends DEC-P9-015) |
| `sessionVersion`                | JWT `sess_ver` — bump on role change / force logout |
| `status`                        | `ACTIVE` required for login                         |
| `labels` / `membershipMetadata` | optional — ability context (legacy parity)          |

Legacy DB values `leader` → normalize to `admin` at hydrate boundary (DEC-P9-015). `viewer` persists as `viewer` (DEC-P9-019). Do **not** persist legacy `leader` in new 9.4 writes.

---

## API routes (`apps/api/src/identity/`)

| METHOD | PATH                      | Actor         | Purpose                   | Legacy equivalent            |
| ------ | ------------------------- | ------------- | ------------------------- | ---------------------------- |
| POST   | `/auth/request-otp`       | Anonymous     | Issue OTP challenge       | `web/otp/request`            |
| POST   | `/auth/verify-otp`        | Anonymous     | Verify + issue JWT        | `web/session/otp`            |
| GET    | `/auth/session`           | Authenticated | Hydrate membership        | session refresh              |
| GET    | `/auth/ability-context`   | Authenticated | CASL labels/caps/modules  | `membership-ability-context` |
| GET    | `/identity/me`            | Authenticated | Read operator profile     | legacy account prefs read    |
| PATCH  | `/identity/me`            | Authenticated | Patch own display name    | legacy account prefs write   |
| POST   | `/auth/phone-preflight`   | Anonymous     | Classify phone (P1)       | `web/phone/preflight`        |
| POST   | `/auth/register/complete` | Anonymous     | Onboarding token exchange | `web/registration/complete`  |

**`/identity/me` contract (S9-R7):**

| Field         | GET | PATCH | Storage                                      |
| ------------- | --- | ----- | -------------------------------------------- |
| `userId`      | ✓   | —     | JWT `sub`                                    |
| `tenantId`    | ✓   | —     | membership row                               |
| `role`        | ✓   | —     | `UserTenant.role` (DB hydrate)               |
| `status`      | ✓   | —     | `UserTenant.status`                          |
| `mobile`      | ✓   | —     | `User.mobile` (read-only)                    |
| `displayName` | ✓   | ✓     | `UserTenant.membership_metadata.displayName` |
| `workspaceId` | ✓   | —     | optional membership field                    |

**Persistence proof:** `identity-me.spec.ts` API-9.6-ME-01..03 (memory) · `phase-9-persistence.integration.spec.ts` **P9-PERSIST-05** (Prisma `STORAGE_DRIVER=prisma` + `DATABASE_URL`) · E2E **SMK-P9-10**.

UI route: `/settings/me` (account nav group · not in Denali manifest). Any authenticated member may read/patch **own** profile only.

**No API `/auth/logout` required** — legacy clears cookie client-side only (DEC-P9-012). Optional future: admin `sess_ver` bump in 9.4.

**Fail-closed:** Missing/invalid session on protected routes → **401** JSON — never empty 200.

---

## Web routes

| PATH                   | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `/auth/login`          | OTP two-step form (canonical) — **only** admin entry                    |
| `/login`               | Alias → same component (middleware redirect target)                     |
| `/auth/register`       | **Redirect** → `/auth/login?access=invite-only` — no self-registration  |
| `/auth/invite/[token]` | Invite entry (9.4 extends accept)                                       |

**Admin panel rule:** operators join via **invite** (`POST /users/invite`) — not public signup. Unknown phones after OTP see an invite-only message on the login form.

BFF: see [`identity-web-bff-addendum.md`](identity-web-bff-addendum.md).

---

## Session contract

| Field            | Source                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `tenantId`       | Host resolve + JWT claim cross-check                                |
| `userId`         | JWT `sub`                                                           |
| `role`           | `UserTenant.role` DB lookup — **not** JWT claim alone (DELTA-NP-04) |
| `sessionVersion` | must match JWT `sess_ver` or **401** `AUTH_TOKEN_REVOKED`           |
| `workspaceType`  | `resolveWorkspaceTypeForTenant(tenantId)`                           |

**Cookie:** name **`session`** · HttpOnly · 7d · See [`OPERATOR-LOGIN-FLOW.md`](OPERATOR-LOGIN-FLOW.md) §4.

---

## Environment variables

See [`env-runtime-matrix.md`](env-runtime-matrix.md) § Identity profile.

| Variable                            | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `AUTH_JWT_PUBLIC_KEY`               | RS256 verify (API + metrics scrape)       |
| `AUTH_JWT_PRIVATE_KEY`              | RS256 sign (`signSessionToken`)           |
| `AUTH_JWT_ISSUER` / `AUTH_JWT_AUDIENCE` | Required with public key              |
| `SESSION_SECRET`                    | Legacy — **not** operator JWT path        |
| `OTP_FIXTURE_CODE`                  | Dev static OTP (default `1234`)           |
| `AUTH_ALLOW_DEV_STATIC_OTP`         | Allow verify without challenge row        |
| `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` | Prod cookie domain                        |
| `ALLOW_DEV_WEB_SESSION`             | **Forbidden in prod** — dev bearer bypass |

---

## Dev JWT bootstrap (1C.1)

Operator login requires a **stable RS256 keypair** in the API process environment. Ephemeral keys (smoke script fallback) break sessions whenever the API restarts with a new pair.

**Bootstrap once per machine:**

```bash
cd apps/api && pnpm run bootstrap:dev-jwt >> .env.local
# or append manually — never commit .env.local
```

Script: `apps/api/scripts/bootstrap-dev-jwt-keys.mjs` emits:

| Variable | Value |
| -------- | ----- |
| `AUTH_JWT_PUBLIC_KEY` | PEM (single line, `\n` escapes) |
| `AUTH_JWT_PRIVATE_KEY` | PKCS#8 PEM |
| `AUTH_JWT_ISSUER` | `tour-ops` |
| `AUTH_JWT_AUDIENCE` | `tour-ops-api` |

**Smoke / manual dev:** when `AUTH_JWT_PUBLIC_KEY` **and** `AUTH_JWT_PRIVATE_KEY` are already set, `smoke-operator-e2e-servers.mjs` reuses them instead of generating ephemeral keys (SMK-P9 JWT parity).

**Production:** inject keys via secret manager; `assertAuthEnvironmentIntegrity()` rejects dev bearer + missing JWT config.

---

## OTP production path (1C.2)

When `AUTH_ALLOW_DEV_STATIC_OTP=false` (staging/production), verify uses **challenge-bound scrypt hash** — not the dev `1234` bypass.

| Step | Behavior |
| ---- | -------- |
| `POST /auth/request-otp` | Generate 6-digit code · store `code_hash` · deliver via SMS provider (or log-only when `RESEND_API_KEY` unset in non-prod) |
| Rate limit | **10 RPM per mobile** (in-memory dev · Redis staging+) → **429** `OTP_RATE_LIMITED` |
| `POST /auth/verify-otp` | Constant-time hash compare · single-use · 5m TTL |
| Dev bypass | `AUTH_ALLOW_DEV_STATIC_OTP=true` + `NODE_ENV=development|test` accepts `1234` when challenge row valid |

| Variable | Purpose |
| -------- | ------- |
| `AUTH_ALLOW_DEV_STATIC_OTP` | `false` in staging/prod (boot throw if `true` in production) |
| `OTP_FIXTURE_CODE` | Non-prod deterministic code at challenge creation (tests) · **forbidden in production** |
| `RESEND_API_KEY` | Optional SMS delivery (P1); unset = log-only delivery in dev |

Migration: `20260609130000_operator_otp_code_hash` adds `mobile_otp_challenges.code_hash`.

Proof: `identity-otp-production.spec.ts` · existing `identity-otp.spec.ts` (dev static path).

---

## Completion proof

| Command                     | Subphase      |
| --------------------------- | ------------- |
| `identity-otp.spec.ts`      | 9.1           |
| `identity-session.spec.ts`  | 9.1           |
| `identity-jwt-signing.spec.ts` | 1C.1 RS256 round-trip |
| `identity-otp-production.spec.ts` | 1C.2 OTP hash + rate limit |
| `auth-login-access.spec.ts` | 9.1           |
| `auth-login-flow.spec.ts`   | 9.1 BFF chain |

---

## Out of scope 9.1

- Users directory CRUD → **9.4**
- Invite accept persist → **9.4**
- Finance/session wallet → **9.7**
- SMS production provider → P1 after OTP_FIXTURE dev path green
