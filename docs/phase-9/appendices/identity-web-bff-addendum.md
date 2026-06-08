# Phase 9.1 — Identity web BFF addendum

```yaml
addendum_id: DISPATCH-P9-IDENTITY-WEB-BFF
version: "2026-06-08-v1"
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
| POST   | `/api/auth/phone-preflight`            | `POST /auth/phone-preflight`                | no                    |

---

## Request/response shapes (browser contract — legacy stable)

### POST `/api/auth/request-otp`

```json
{ "phone": "+989121000001", "invite_token": "optional" }
```

→ `{ "ok": true, "challenge_id": "<uuid>" }`

BFF maps `phone` → API body `{ "mobile": "<E.164>" }`.

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

Registration required → `{ "ok": false, "requires_registration": true, "onboarding_token": "..." }`

Dev retry: if `AUTH_OTP_INVALID` with `challenge_id`, retry without `challenge_id` (legacy login-form behavior).

### GET `/api/auth/membership-ability-context`

Proxies Authorization Bearer (from cookie mirror or session response) → ability labels for nav/CASL hydration.

---

## Cookie builder (port semantics)

Target modules (from legacy):

| Legacy                                             | Trunk                                       |
| -------------------------------------------------- | ------------------------------------------- |
| `legacy/apps/web/lib/auth/build-session-cookie.ts` | `apps/web/lib/auth/build-session-cookie.ts` |
| `legacy/apps/web/lib/auth/session-cookie.ts`       | `apps/web/lib/auth/session-cookie.ts`       |
| `legacy/apps/web/lib/auth/session.ts`              | `apps/web/lib/auth/session.ts`              |

Constants: `SESSION_COOKIE_MAX_AGE_SECONDS = 604800` · cookie name **`session`**.

---

## Host forwarding

BFF must forward workspace **Host** header to API for tenant resolution (legacy `bff-fetch.ts` semantics):

```typescript
headers: { Host: request.headers.get("host") ?? "", ... }
```

---

## Verification

| Spec                        | Cases                                                             |
| --------------------------- | ----------------------------------------------------------------- |
| `auth-login-flow.spec.ts`   | BFF-9.1-01 request-otp · BFF-9.1-02 login-web-session sets cookie |
| `auth-login-access.spec.ts` | middleware redirect                                               |
