# Auth / OTP local debugging map

---

## 18. Local dev OTP `1234` — API env configuration & verification

### 18.1 Where API environment is set

| Mechanism | Location | Role |
|-----------|----------|------|
| **Primary local file** | `apps/api/.env` | Loaded by `node --env-file=.env` on `pnpm dev`, seeds, migrations, and `auth:debug-audit` |
| **Template** | `apps/api/.env.example` | Documents defaults: `NODE_ENV=development`, `AUTH_ALLOW_DEV_STATIC_OTP=true` |
| **E2E / test** | `apps/api/.env.test.example`, E2E `before()` hooks | `NODE_ENV=test`, `AUTH_ALLOW_DEV_STATIC_OTP=true` |
| **Runtime validation** | `apps/api/src/config/config.validation.ts` → `env.schema.ts` | Parses `process.env` at boot into `ConfigService` |
| **Dev server script** | `apps/api/package.json` → `"dev"` | Builds workspace packages, then starts API |

**`pnpm dev` (updated):**

```json
"dev": "... && NODE_ENV=development node --env-file=.env dist/main.js"
```

`NODE_ENV=development` is set **on the command line before** `--env-file=.env`. Node does **not** overwrite variables already present in the environment when applying the env file, so local `pnpm dev` always runs as **development** even if `.env` were changed to another value.

Other scripts that load `.env` explicitly (no forced `NODE_ENV`):

- `"seed"`, `"migrate:run"`, `"auth:debug-audit"`, etc. → `node --env-file=.env --import tsx ...`
- `"start"` / `"start:prod"` → `node dist/main.js` (expects env from host/process manager, not `--env-file`)

**Nest boot:** `ConfigService` constructor calls `validateEnvironmentOrThrow(process.env)` (`config.service.ts`). `OtpService.isDevStaticOtpEnabled()` reads `configService.getNodeEnv()` and `getAuthAllowDevStaticOtp()`.

---

### 18.2 `OtpService` gate (why `1234` works locally)

```typescript
// otp.service.ts — isDevStaticOtpEnabled()
(nodeEnv === "development" || nodeEnv === "test") && getAuthAllowDevStaticOtp()
```

`getAuthAllowDevStaticOtp()` (`config.service.ts`):

- `AUTH_ALLOW_DEV_STATIC_OTP=true` → `true`
- `AUTH_ALLOW_DEV_STATIC_OTP=false` → `false`
- unset → `true` only when `NODE_ENV` is `development` or `test`

Both conditions must pass for static OTP `1234`.

---

### 18.3 Updated `apps/api/.env` (confirmed)

The following entries are present in **`apps/api/.env`** (gitignored; not committed):

```env
NODE_ENV=development
AUTH_ALLOW_DEV_STATIC_OTP=true
```

These match `apps/api/.env.example` (lines 3 and 49). No other `.env` changes were required for OTP debugging.

---

### 18.4 Verification steps

#### A. Confirm `.env` keys (shell)

```bash
cd apps/api
grep '^NODE_ENV=' .env
grep '^AUTH_ALLOW_DEV_STATIC_OTP=' .env
```

**Expected:**

```
NODE_ENV=development
AUTH_ALLOW_DEV_STATIC_OTP=true
```

#### B. Automated `ConfigService` + `OtpService` check (repo test)

**File:** `apps/api/src/modules/auth/otp-dev-env-verify.spec.ts`

```bash
cd apps/api
NODE_ENV=development node --env-file=.env --import tsx --test src/modules/auth/otp-dev-env-verify.spec.ts
```

**Captured output (2026-05-29):**

```
[VERIFY] ConfigService (loaded via --env-file=.env):
  NODE_ENV=development
  AUTH_ALLOW_DEV_STATIC_OTP (resolved)=true
  isDevStaticOtpEnabled (OtpService gate)=true

[VERIFY] OtpService.verifyMobileOtp (development, code=1234):
 {
   "error": {
     "code": "AUTH_OTP_INVALID",
     "message": "Invalid or expired OTP challenge"
   }
 }

[VERIFY] OtpService.verifyMobileOtp (development, code=0000):
 {
   "error": {
     "code": "AUTH_OTP_INVALID",
     "message": "Invalid OTP code"
   }
 }

# tests 3
# pass 3
# fail 0
```

**Interpretation:**

| Check | Result |
|-------|--------|
| `NODE_ENV` | `development` |
| `AUTH_ALLOW_DEV_STATIC_OTP` | `true` |
| `isDevStaticOtpEnabled` | `true` |
| `1234` + random `challenge_id` | **Not** rejected with *"OTP verification is not available"* — passes production guard, fails only on missing DB challenge (*expected* without a real challenge row) |
| `0000` in development | Rejected with *"Invalid OTP code"* — static OTP path is active |

#### C. Optional: auth debug audit (DB + HTTP)

Requires running API on `PORT` and seeded user:

```bash
cd apps/api
pnpm run auth:debug-audit
```

#### D. Confirm `pnpm dev` forces development

```bash
cd apps/api
grep '"dev"' package.json
# should show: NODE_ENV=development node --env-file=.env dist/main.js
```

Restart API after any `.env` change: `pnpm --filter @apps/api dev`.

---

### 18.5 Configuration confirmation summary

| Item | Status |
|------|--------|
| `apps/api/.env` → `NODE_ENV=development` | Confirmed |
| `apps/api/.env` → `AUTH_ALLOW_DEV_STATIC_OTP=true` | Confirmed |
| `package.json` `dev` script forces `NODE_ENV=development` | **Updated** |
| `OtpService` + `ConfigService` detect dev static OTP | **Verified** (3/3 tests, output above) |

**Login without `challenge_id`:** `AuthService.createWebSessionOtp` uses `validatePhoneOtp` and accepts `1234` when the same gate is true (no DB challenge required). **With `challenge_id`:** `verifyMobileOtp` requires a valid `mobile_otp_challenges` row after the static code check.

**Production reminder:** `NODE_ENV=production` disables static OTP regardless of `AUTH_ALLOW_DEV_STATIC_OTP=true` (see `otp-production-static-1234.spec.ts`).

---

## 19. Login + refresh logout — debug session `5c8e58` (2026-05-29)

### 19.1 Runtime evidence (pre-fix)

| Hypothesis | Verdict | Log evidence |
|------------|---------|----------------|
| H1 API rejects OTP | **REJECTED** | `backendStatus:200`, `hasSessionToken:true` |
| H2 Cookie / host | **CONFIRMED** | `hasCookie:true` but `validationStatus:"expired"` on `denali.localhost:3000` |
| H3 Middleware redirect | **CONFIRMED** | `/dashboard` → `validationStatus:"expired"` |
| H4 Hydrate clears user | **CONFIRMED** | `hydrate unauthenticated` after session GET with expired token |
| H5 Missing user_id/tenant_id | **REJECTED** | `hasUserId:true`, `hasTenantId:true` |

**Root cause:** Browser kept a **legacy host-only** `session` cookie with an **expired JWT**. Login set a new **`Domain=.localhost`** cookie, but middleware/`cookies().get()` still read the **old host-only** token → immediate `expired` → redirect to `/login` and cookie clear on hydrate.

Login API and OTP `1234` were fine; session persistence was broken by duplicate cookie names.

### 19.2 Fix (instrumentation kept for verification)

**File:** `apps/web/lib/auth/build-session-cookie.ts`

- `buildClearHostOnlySessionCookieOptions()` — clears cookie without `Domain`
- `setSessionCookieOnResponse()` — clears host-only duplicate, then sets domain-scoped cookie
- `clearAllSessionCookiesOnResponse()` — clears both variants

Wired in: `login-web-session`, `session`, `complete-registration`, `workspace-session`, `logout`, `middleware`.

### 19.3 Post-fix verification

```bash
cd apps/web
node --import tsx --test lib/auth/build-session-cookie.spec.ts
```

Reproduce login + refresh; debug log should show `validationStatus:"valid"` and `runId:"post-fix"` on `/dashboard` middleware.

**One-time browser cleanup if still stuck:** DevTools → Application → Cookies → `denali.localhost` → delete all `session` cookies, then login again.

### 19.4 `membership-ability-context` curl (not the login root cause)

`GET /api/auth/membership-ability-context` runs **after** login (AuthProvider) to load CASL labels. It requires an HttpOnly `session` cookie via `requireBffSession()`.

A curl **without** `Cookie:` (as in the reported request) always returns **401** `AUTH_UNAUTHENTICATED` — expected, not a login blocker.

### 19.5 Post-fix v2 — dev cookie default host-only (2026-05-29)

**Evidence:** After v1 fix (clear host-only + set `Domain=.localhost`), logs showed login **200** but `/dashboard` middleware `hasCookie:false` — Chrome did not store/send the domain-scoped cookie.

**Change:** Dev default `resolveSessionCookieDomain()` → **host-only** (`undefined`). On login, also clear legacy `Domain=.localhost` cookies. Opt-in sharing: `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.localhost`.

Expected log after v2: `cookieDomain:"host-only"` and middleware `validationStatus:"valid"`, `hasCookie:true`.

### 19.6 Env override blocked v2 (2026-05-29 reproduction)

Post-fix-v2 logs still showed `cookieDomain:".localhost"` because **`apps/web/.env.local`** had:

```env
NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.localhost
```

**Fix applied:** changed to `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=host-only` in `.env.local` and `.env.local.example`. **Restart `pnpm dev` for web** — `NEXT_PUBLIC_*` is baked in at build/start.

### 19.7 Verified fixed (2026-05-29)

Post `host-only` env + cookie helpers:

| Step | Log evidence |
|------|----------------|
| Login | `cookieDomain:"host-only"`, `backendStatus:200` |
| `/dashboard` | `validationStatus:"valid"`, `hasCookie:true`, `jwtExp` ≈ now+7d |
| Navigation | `/tours`, `/finance`, `/users` — all `valid` |
| Session hydrate | `session/route.ts` `validationStatus:"valid"` |

Debug instrumentation removed after verification.

### 19.8 Refresh logout — duplicate `session` cookies (2026-05-29)

**Symptom:** After F5, user appears logged out even when middleware had shown `valid` earlier.

**Evidence (prior logs):** `session/route.ts` logged `validationStatus:valid` while `AuthProvider` immediately logged `hydrate unauthenticated` — `cookies().get("session")` returned a **stale/expired** duplicate; `GET /api/auth/session` then called `clearCookie()` and wiped the **valid** host-only cookie too.

**Fix:** `lib/auth/resolve-session-cookie.ts` — `pickSessionTokenFromRequestCookies()` / `pickSessionTokenFromValues()` choose the **first valid** JWT among duplicates. Used in `middleware.ts`, `session/route.ts` GET, and `bff-proxy.ts` `readSessionToken()`. Successful session GET re-issues cookie via `setSessionCookieOnResponse` to consolidate duplicates on refresh.

### 19.9 Refresh logout — inflight `Response` body consumed twice (2026-05-29)

**Evidence:** Logs showed `session/route.ts` `validationStatus:valid` then `AuthProvider` `hydrate unauthenticated` 14ms later (HTTP 200).

**Cause:** `inflightBffGet` deduped React Strict Mode double-mount but cached the raw `Response`. Two `consumeHydrateResponse` callers both called `.json()` on the same body → second read `{}` → `authenticated` false → `setUser(null)` (UI logout while middleware still had a valid cookie).

**Fix:** Parse JSON **inside** the inflight fetcher in `auth-context.tsx` (`SessionHydrateFetchResult`) and `membership-ability-context.ts`. Documented in `inflight-bff-get.ts`. Test: `inflight-bff-get.spec.ts`.
-+