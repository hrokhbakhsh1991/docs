# Phase 9.1 — Identity web BFF addendum

```yaml
addendum_id: DISPATCH-P9-IDENTITY-WEB-BFF
version: "2026-06-10-v2"
authority: OPERATOR-LOGIN-FLOW.md · legacy/apps/web/app/api/auth/
target: apps/web/app/api/auth/**
decisions: [DEC-P9-012]
```

> Browser-facing auth routes. **Cookie is set only in BFF** — API returns `sessionToken` JSON; BFF calls `buildSessionCookieOptions()`.

---

## BFF route matrix

| Method | BFF path                               | Upstream API                                | Sets `session` cookie |
| ------ | -------------------------------------- | ------------------------------------------- | --------------------- |
| POST   | `/api/auth/request-otp`                | `POST /auth/request-otp`                    | no                    |
| POST   | `/api/auth/login-web-session`          | `POST /auth/verify-otp`                     | **yes** on success    |
| GET    | `/api/auth/session`                    | local decode + optional `GET /auth/session` | consolidate only      |
| POST   | `/api/auth/session`                    | local                                       | mirror localStorage   |
| DELETE | `/api/auth/session`                    | local                                       | clear                 |
| POST   | `/api/auth/logout`                     | **none**                                    | **clear**             |
| GET    | `/api/auth/membership-ability-context` | `GET /auth/ability-context`                 | no                    |
| GET    | `/api/identity/me`                       | `GET /identity/me`                            | no                    |
| PATCH  | `/api/identity/me`                       | `PATCH /identity/me`                          | no                    |
| POST   | `/api/auth/phone-preflight`            | `POST /auth/phone-preflight`                | no                    |

`phone-preflight` is listed in `middleware.ts` `PUBLIC_BFF_API_PATHS` (anonymous login classify).

---

## Request/response shapes (browser contract — legacy stable)

### POST `/api/auth/request-otp`

```json
{ "phone": "+989121000001", "invite_token": "optional" }
```

→ `{ "ok": true, "challenge_id": "<uuid>" }`

Failure → `{ "ok": false, "error": { "code": "<STABLE_CODE>" } }` via `bffCodedError()` — **no** `message` leak to browser.

Empty `phone` → `MOBILE_REQUIRED` (400). Empty `otp` on login → `OTP_PAYLOAD_INVALID` (400).

Common codes: `AUTH_PHONE_NOT_AUTHORIZED` (403) · `MOBILE_INVALID` (400) · `OTP_RATE_LIMITED` (429) · `BACKEND_UNREACHABLE` (502).

BFF maps `phone` → API body `{ "mobile": "<E.164>" }`.

Upstream base URL: `resolveTourOpsApiBaseUrl()` (`TOUR_OPS_API_URL`) — neutral name for all operator workspaces (Denali, Urban, smoke).

### POST `/api/auth/login-web-session`

```json
{
  "phone": "+989121000001",
  "otp": "1234",
  "challenge_id": "optional-uuid",
  "invite_token": "optional"
}
```

Success → `{ "ok": true, "session_token": "...", "user_id": "...", "tenant_id": "..." }` + `Set-Cookie: session=...`

Registration required (API `requiresRegistration`) → `{ "ok": false, "error": { "code": "AUTH_PHONE_NOT_AUTHORIZED" } }` — admin web shows invite-only field error; **no** registration navigation.

OTP failure → `{ "ok": false, "error": { "code": "OTP_INVALID" | "OTP_EXPIRED" | "OTP_CHALLENGE_INVALID" | ... } }`.

### POST `/api/auth/phone-preflight`

```json
{ "phone": "+989121000001" }
```

→ `{ "ok": true, "authorized": true | false }` or `{ "ok": false, "error": { "code": "..." } }`.

### GET `/api/auth/membership-ability-context`

Proxies Authorization Bearer (from cookie mirror or session response) → ability labels for nav/CASL hydration.

---

## Cookie builder (port semantics)

Trunk modules live under `apps/web/src/auth/**` (import alias `@/auth/*`):

| Legacy                                             | Trunk                                       |
| -------------------------------------------------- | ------------------------------------------- |
| `legacy/apps/web/lib/auth/build-session-cookie.ts` | `apps/web/src/auth/build-session-cookie.ts` |
| `legacy/apps/web/lib/auth/session-cookie.ts`       | `apps/web/src/auth/build-session-cookie.ts` |
| `legacy/apps/web/lib/auth/session.ts`              | `apps/web/src/auth/read-session-token.ts`   |

Constants: `SESSION_COOKIE_MAX_AGE_SECONDS = 604800` · cookie name **`session`**.

---

## Host forwarding

BFF must forward workspace **Host** header to API for tenant resolution (legacy `bff-fetch.ts` semantics):

```typescript
headers: { Host: request.headers.get("host") ?? "", ... }
```

---

## Anonymous login shim (`buildIdentityBffHeaders`)

Pre-session routes (`request-otp`, `phone-preflight`, `login-web-session` before cookie) have **no** operator JWT. The BFF still must give the API a resolvable `tenantId` from the browser **Host** (e.g. `denali.localhost:3000` → `…000003`).

`buildIdentityBffHeaders()` therefore sends a **synthetic ingress** for tenant kernel only:

| Header | Shim value | Purpose |
| ------ | ---------- | ------- |
| `x-tenant-id` | Host map / `TOUR_OPS_DEV_TENANT_ID` | Tenant scope for OTP gate |
| `x-authenticated-tenant-id` | same | Kernel parity |
| `x-user-id` | fixed anonymous UUID | Satisfies header-path ingress |
| `x-actor-role` | `member` | Not used for authorization |
| `x-membership-status` | `ACTIVE` | **Not** proof of membership |

**Security contract:** shim headers do **not** grant abilities. Authorization is enforced by:

1. `isPhoneAuthorizedForTenantLogin` before `MobileOtpChallenge` is created (`request-otp` → 403 `AUTH_PHONE_NOT_AUTHORIZED`).
2. `requireOperatorSession` + DB hydrate on every protected API route after `verify-otp`.

New BFF or API handlers must **not** treat `x-membership-status: ACTIVE` on anonymous login traffic as authenticated — always call the identity gate or session middleware.

---

## BFF login rate limit

Anonymous login routes apply an in-process throttle **before** upstream API calls (`bff-login-rate-limit.ts`):

| Route | Limit | Window | Key |
| ----- | ----- | ------ | --- |
| `request-otp` | 10 | 60s | `{host}:{ip}:{phone}` |
| `phone-preflight` | 10 | 60s | `{host}:{ip}:{phone}` |

Exceeded → `{ "ok": false, "error": { "code": "OTP_RATE_LIMITED" } }` (429). API OTP rate limit remains authoritative; BFF layer is defense-in-depth until edge WAF/gateway is deployed.

---

## Verification

| Spec                        | Cases                                                             |
| --------------------------- | ----------------------------------------------------------------- |
| `auth-login-flow.spec.ts`   | BFF-9.1-01 request-otp · BFF-9.1-02 login-web-session sets cookie |
| `auth-bff-login-codes.spec.ts` | BFF-LOGIN-06 BFF rate limit                                    |
| `bff-login-rate-limit.spec.ts` | BFF-RL-01..02 key + window                                     |
| `auth-login-access.spec.ts` | middleware redirect                                               |
