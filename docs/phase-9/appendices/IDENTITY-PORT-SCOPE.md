# Identity port scope — Phase 9.1 delta

```yaml
scope_version: "2026-06-08-v2"
decision: [DEC-P9-003, DEC-P9-012]
delta_refs: [DELTA-NP-01, DELTA-NP-02, DELTA-NP-04]
prisma_schema: apps/api/prisma/schema.prisma
migration_target: infra/sql/005_identity_production_delta.sql
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

### Forbidden in 9.1

| Pattern                                        | Reason                                    |
| ---------------------------------------------- | ----------------------------------------- |
| `UserSession` server-side session table as SoT | Legacy uses JWT + `sess_ver` — DEC-P9-012 |
| TypeORM entities                               | Prisma only — DEC-P9-003                  |

### `UserTenant` fields (minimum)

| Column                          | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `role`                          | `owner` \| `admin` \| `member` — **DEC-P9-015**     |
| `sessionVersion`                | JWT `sess_ver` — bump on role change / force logout |
| `status`                        | `ACTIVE` required for login                         |
| `labels` / `membershipMetadata` | optional — ability context (legacy parity)          |

Legacy DB values `leader` → normalize to `admin`; `viewer` → `member` at hydrate boundary (DEC-P9-015). Do **not** persist five-role strings in new 9.4 writes.

---

## API routes (`apps/api/src/identity/`)

| METHOD | PATH                      | Actor         | Purpose                   | Legacy equivalent            |
| ------ | ------------------------- | ------------- | ------------------------- | ---------------------------- |
| POST   | `/auth/request-otp`       | Anonymous     | Issue OTP challenge       | `web/otp/request`            |
| POST   | `/auth/verify-otp`        | Anonymous     | Verify + issue JWT        | `web/session/otp`            |
| GET    | `/auth/session`           | Authenticated | Hydrate membership        | session refresh              |
| GET    | `/auth/ability-context`   | Authenticated | CASL labels/caps/modules  | `membership-ability-context` |
| POST   | `/auth/phone-preflight`   | Anonymous     | Classify phone (P1)       | `web/phone/preflight`        |
| POST   | `/auth/register/complete` | Anonymous     | Onboarding token exchange | `web/registration/complete`  |

**No API `/auth/logout` required** — legacy clears cookie client-side only (DEC-P9-012). Optional future: admin `sess_ver` bump in 9.4.

**Fail-closed:** Missing/invalid session on protected routes → **401** JSON — never empty 200.

---

## Web routes

| PATH                   | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `/auth/login`          | OTP two-step form (canonical)                       |
| `/login`               | Alias → same component (middleware redirect target) |
| `/auth/register`       | Post-OTP onboarding when no membership              |
| `/auth/invite/[token]` | Invite entry (9.4 extends accept)                   |

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
| `SESSION_SECRET` / JWT keys         | RS256 sign/verify                         |
| `OTP_FIXTURE_CODE`                  | Dev static OTP (default `1234`)           |
| `AUTH_ALLOW_DEV_STATIC_OTP`         | Allow verify without challenge row        |
| `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` | Prod cookie domain                        |
| `ALLOW_DEV_WEB_SESSION`             | **Forbidden in prod** — dev bearer bypass |

---

## Completion proof

| Command                     | Subphase      |
| --------------------------- | ------------- |
| `identity-otp.spec.ts`      | 9.1           |
| `identity-session.spec.ts`  | 9.1           |
| `auth-login-access.spec.ts` | 9.1           |
| `auth-login-flow.spec.ts`   | 9.1 BFF chain |

---

## Out of scope 9.1

- Users directory CRUD → **9.4**
- Invite accept persist → **9.4**
- Finance/session wallet → **9.7**
- SMS production provider → P1 after OTP_FIXTURE dev path green
