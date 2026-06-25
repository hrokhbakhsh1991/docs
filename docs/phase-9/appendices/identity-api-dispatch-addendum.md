# Phase 9.1 — Identity API dispatch addendum

```yaml
addendum_version: "2026-06-08-v2"
subphase: "9.1"
authority: OPERATOR-LOGIN-FLOW.md · CASL-OPERATOR-SPEC.md · IDENTITY-PORT-SCOPE.md
inventory_sot: apps/api/src/openapi/dispatch-routes.ts
decisions: [DEC-P9-003, DEC-P9-012]
legacy_mapping: identity-web-bff-addendum.md
```

---

## Legacy → trunk mapping

| Legacy Nest                                   | Trunk Fastify                  | operationId             |
| --------------------------------------------- | ------------------------------ | ----------------------- |
| `POST /api/v2/auth/web/otp/request`           | `POST /auth/request-otp`       | `requestOtp`            |
| `POST /api/v2/auth/web/session/otp`           | `POST /auth/verify-otp`        | `verifyOtp`             |
| `GET /api/v2/auth/membership-ability-context` | `GET /auth/ability-context`    | `getAuthAbilityContext` |
| `POST /api/v2/auth/web/phone/preflight`       | `POST /auth/phone-preflight`   | `phonePreflight`        |
| `POST /api/v2/auth/web/registration/complete` | `POST /auth/register/complete` | `completeRegistration`  |

---

## `DISPATCH_ROUTES` insertion contract

| Field           | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| **Target file** | `apps/api/src/openapi/dispatch-routes.ts`                      |
| **Block label** | `// Phase 9.1 — identity production (INV-P9-007 · DEC-P9-012)` |
| **Count**       | **+6** rows                                                    |

### Literal insertion payload

```typescript
  // Phase 9.1 — identity production (INV-P9-007 · DEC-P9-012)
  { method: "POST", path: "/auth/request-otp", operationId: "requestOtp" },
  { method: "POST", path: "/auth/verify-otp", operationId: "verifyOtp" },
  { method: "GET", path: "/auth/session", operationId: "getAuthSession" },
  { method: "GET", path: "/auth/ability-context", operationId: "getAuthAbilityContext" },
  { method: "GET", path: "/identity/me", operationId: "getIdentityMe" },
  { method: "PATCH", path: "/identity/me", operationId: "patchIdentityMe" },
  { method: "POST", path: "/identity/me/avatar", operationId: "uploadIdentityMeAvatar" },
  { method: "DELETE", path: "/identity/me/avatar", operationId: "deleteIdentityMeAvatar" },
  { method: "GET", path: "/identity/me/avatar/url", operationId: "getIdentityMeAvatarUrl" },
  { method: "POST", path: "/auth/phone-preflight", operationId: "phonePreflight" },
  { method: "POST", path: "/auth/register/complete", operationId: "completeRegistration" },
```

**Note:** No `POST /auth/logout` — DEC-P9-012 matches legacy (BFF cookie clear only).

---

## Route binding matrix

| HTTP                           | operationId             | Handler                   | Middleware                         |
| ------------------------------ | ----------------------- | ------------------------- | ---------------------------------- |
| `POST /auth/request-otp`       | `requestOtp`            | `identity/auth.routes.ts` | tenant resolve · rate limit 10 RPM |
| `POST /auth/verify-otp`        | `verifyOtp`             | same                      | tenant resolve · issues JWT        |
| `GET /auth/session`            | `getAuthSession`        | same                      | `requireOperatorSession`           |
| `GET /auth/ability-context`    | `getAuthAbilityContext` | same                      | `requireOperatorSession`           |
| `GET /identity/me`             | `getIdentityMe`         | `identity/me.routes.ts`   | `requireOperatorSession`           |
| `PATCH /identity/me`           | `patchIdentityMe`       | same                      | `requireOperatorSession` · self only |
| `POST /identity/me/avatar`     | `uploadIdentityMeAvatar`| `identity/me.avatar.routes.ts` | `requireOperatorSession` · self · binary body |
| `DELETE /identity/me/avatar`   | `deleteIdentityMeAvatar`| same                      | `requireOperatorSession` · self only |
| `GET /identity/me/avatar/url`  | `getIdentityMeAvatarUrl`| same                      | `requireOperatorSession` · signed read |
| `POST /auth/phone-preflight`   | `phonePreflight`        | same                      | tenant resolve                     |
| `POST /auth/register/complete` | `completeRegistration`  | same                      | onboarding token validate          |

Protected tour routes add `requireOperatorSession` in **9.3**.

---

## `verifyOtp` response (legacy parity)

Success:

```json
{
  "sessionToken": "<jwt>",
  "userId": "<uuid>",
  "tenantId": "<uuid>",
  "role": "admin"
}
```

No membership:

```json
{
  "requiresRegistration": true,
  "onboardingToken": "<token>"
}
```

BFF maps to legacy browser shape (`session_token`, `requires_registration`, etc.).

---

## Error catalog

| Code                 | HTTP | When                       |
| -------------------- | ---- | -------------------------- |
| `OTP_INVALID`        | 401  | Wrong code                 |
| `OTP_EXPIRED`        | 401  | Challenge TTL exceeded     |
| `IDENTITY_REQUIRED`  | 401  | Protected route no session |
| `AUTH_TOKEN_REVOKED` | 401  | `sess_ver` mismatch        |
| `TENANT_MISMATCH`    | 403  | Host ≠ membership tenant   |

See schemas in [`schemas/`](schemas/).

---

## Schemas

| Route                       | Schema                                       |
| --------------------------- | -------------------------------------------- |
| `POST /auth/request-otp`    | `IDENTITY-OTP-REQUEST.schema.json`           |
| `POST /auth/verify-otp`     | `IDENTITY-OTP-VERIFY.schema.json`            |
| `GET /auth/session`         | `IDENTITY-SESSION-RESPONSE.schema.json`      |
| `GET /auth/ability-context` | `IDENTITY-ABILITY-CONTEXT.schema.json` (new) |
