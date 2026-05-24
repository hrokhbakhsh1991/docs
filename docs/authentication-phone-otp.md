# Phone + OTP authentication (web)

Canonical reference for workspace **web** login. Password-based **web** login is not supported; session creation uses **phone + OTP** only.

---

## 1. Authentication flow (unified sign-in / sign-up)

1. **Phone** — User enters a phone number on `/login` (single entry point). The client normalizes formatting (digits and optional leading `+`), then calls `POST /api/v2/auth/web/otp/request` and stores `challenge_id`.
2. **OTP** — User enters the one-time code (UI step 2).
3. **Session or onboarding** — `POST /api/v2/auth/web/session/otp` (with `phone`, `otp`, and `challenge_id` when available):
   - **Existing user** with active workspace membership → `session_token` (JWT) scoped to the tenant from **Host**; web sets the session cookie.
   - **New phone** (OTP verified, no `users` row) → `requires_registration: true` and short-lived `onboarding_token`; UI redirects to `/auth/register` to collect name (and optional email), then `POST /api/v2/auth/web/registration/complete` issues the session.

There is no separate “do you have an account?” step. `/auth/register` without `?onboarding=` redirects back to `/login`.

Telegram login remains a separate path: `POST /api/v2/auth/telegram/session`.

---

## 2. API endpoint

**`POST /api/v2/auth/web/session/otp`**

- **Auth:** Public (no bearer required).
- **Tenant:** Resolved **only** from `Host` (and trusted `X-Forwarded-Host` when configured) as `{slug}.{TENANT_ROOT_DOMAIN}`. There is **no** `tenant_id` in the JSON body.

**Request body (JSON):**

```json
{
  "phone": "+989121236598",
  "otp": "1234",
  "challenge_id": "uuid-from-otp-request"
}
```

**Success (200), existing user:** `session_token`, `user_id`, `tenant_id`, `entry_mode: "web"` (see OpenAPI `WebSessionResponseDto`).

**Success (200), new user:** `requires_registration: true`, `onboarding_token` (no session cookie until registration completes).

**Common errors:** `AUTH_OTP_INVALID`, `AUTH_PHONE_INVALID` (OTP not verified), `TENANT_HOST_UNKNOWN`, `TENANT_CONTEXT_MISSING`, `AUTH_NO_ACTIVE_MEMBERSHIP` (user exists but no active membership in this workspace).

---

## 3. Multi-tenant login

The workspace tenant is **always** derived from the subdomain on the request the browser makes to the API.

**Local example:** UI at `http://ws1-rbac.localhost:3000` with API on the same host or `NEXT_PUBLIC_API_DYNAMIC_ORIGIN` + port so the API sees:

- `Host: ws1-rbac.localhost` (or `ws1-rbac.<TENANT_ROOT_DOMAIN>` in real deployments)

The API maps the workspace label to a `tenants.subdomain` row and enforces `user_tenants` membership for that tenant before issuing the JWT.

---

## 4. Development login

In **non-production** environments (`NODE_ENV !== "production"`), the API accepts the static OTP **`1234`** for local and automated testing.

**Production:** Static OTP is disabled; a real OTP provider / policy must be used (not documented here as product-specific).

---

## 5. Database schema (identity)

Relevant columns on **`users`** (see migration `1777582000000-AddUsersPhoneOtpFields.ts` and `UserEntity`):

| Item | Description |
|------|-------------|
| **`users.phone`** | Nullable `varchar`; unique index `uq_users_phone` where set. Store E.164-style values when possible. |
| **`users.is_phone_verified`** | Boolean; default `false`. Product policy may require verification before login in future. |
| **`users.email`** | **Nullable** `varchar(320)` after migration `MakeUserEmailTrulyNullable1777600500000`. Phone-first registration may leave `email IS NULL`; uniqueness applies only when set (`idx_user_email_unique` partial index). Legacy synthetic `@local.invalid` addresses are cleared on migrate. |
| **`phone_normalized(text)`** | PostgreSQL **function** (same migration) used in OTP login to compare normalized forms (strip whitespace and characters other than digits and `+`). **There is no `users.phone_normalized` column** in the current schema—matching uses `phone_normalized(users.phone)` vs `phone_normalized(:input)`. |

`users.hashed_password` remains a **required** column for ORM/legacy reasons (e.g. Telegram-provisioned users); it is **not** used for web OTP login.

---

## 6. Frontend steps

Implemented in `apps/web/app/auth/login/login-form.tsx` and `apps/web/app/auth/register/register-form.tsx`:

1. **Step 1 — Phone:** `POST /api/auth/request-otp` (BFF → `web/otp/request`); store `challenge_id`.
2. **Step 2 — OTP:** `POST /api/auth/login-web-session` (BFF → `web/session/otp`) with `phone`, `otp`, `challenge_id`.
3. **Branch:** session cookie + `/dashboard`, or redirect to `/auth/register?onboarding=…` for profile completion.
4. **Register:** `POST /api/auth/complete-registration` (BFF → `web/registration/complete`) with `full_name` and optional `email`; phone-only users are stored with `email = null`, then session + `/dashboard`.

Settings shows **«ایمیلی ثبت نشده است»** when `email` is null (`EmailSettingsPanel`); users can add email later from workspace settings.

BFF routes: `apps/web/app/api/auth/request-otp`, `login-web-session`, `complete-registration`. Optional legacy `phone-preflight` remains on the API but is not used by the login UI.

---

## Related code

- API: `apps/api/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `dto/phone-session.dto.ts`
- Tenant host: `apps/api/src/common/tenant/tenant-resolver.middleware.ts`, `docs/multi-tenant-subdomain.md`
- Types: `packages/types/src/auth.ts` (`PhoneOtpLoginRequest`)
