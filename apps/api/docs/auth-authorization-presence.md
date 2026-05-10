# Auth: middleware vs Nest guards (`AuthorizationPresenceGuard`)

**TL;DR:** Validating the Bearer token/JWT happens in **`AuthMiddleware`** (`apps/api/src/common/middleware/auth.middleware.ts`). Route-level **`AuthorizationPresenceGuard`** only checks that an `Authorization` header is present so controllers do not run without authentication plumbing.

## Why separate?

- Middleware runs **early** (session/JWT extraction, tenant binding, ALS `RequestContext`).
- Nest guards classify routes (e.g. “must look authenticated”) **without duplicating JWT crypto** alongside middleware.

## Backward compatibility

`JwtAuthGuard` remains an alias of `AuthorizationPresenceGuard` in `jwt-auth.guard.ts` for older imports/tests.

## PII note

Profile **national ID** persistence is **not encrypted at rest** here; threats and mitigations (field-level crypto, KMS) belong in product threat modeling, not implied by guard naming.
