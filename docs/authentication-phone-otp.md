# Phone + OTP authentication (web)

Canonical reference for workspace **web** login. Password-based **web** login is not supported; session creation uses **phone + OTP** only.

---

## 1. Authentication flow

1. **Phone** — User enters a phone number (UI step 1). The client normalizes formatting (digits and optional leading `+`) before calling the API.
2. **OTP** — User enters the one-time code (UI step 2).
3. **Session creation** — `POST /api/v2/auth/web/session/otp` returns a JWT (`session_token`) scoped to the tenant resolved from the HTTP **Host** (subdomain). The web app stores it in the session cookie and attaches it as `Authorization: Bearer …` on subsequent requests.

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
  "otp": "1234"
}
```

**Success (200):** `session_token`, `user_id`, `tenant_id`, `entry_mode: "web"` (see OpenAPI `WebSessionResponseDto`).

**Common errors:** `AUTH_UNAUTHENTICATED` (wrong OTP / unknown phone for tenant), `TENANT_HOST_UNKNOWN`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN` (user not a member of the resolved workspace).

---

## 3. Multi-tenant login

The workspace tenant is **always** derived from the subdomain on the request the browser makes to the API.

**Local example:** UI at `http://denali.localhost:3000` with API on the same host or `NEXT_PUBLIC_API_DYNAMIC_ORIGIN` + port so the API sees:

- `Host: denali.localhost` (or `denali.<TENANT_ROOT_DOMAIN>` in real deployments)

The API maps the label `denali` to a `tenants.subdomain` row and enforces `user_tenants` membership for that tenant before issuing the JWT.

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
| **`phone_normalized(text)`** | PostgreSQL **function** (same migration) used in OTP login to compare normalized forms (strip whitespace and characters other than digits and `+`). **There is no `users.phone_normalized` column** in the current schema—matching uses `phone_normalized(users.phone)` vs `phone_normalized(:input)`. |

`users.hashed_password` remains a **required** column for ORM/legacy reasons (e.g. Telegram-provisioned users); it is **not** used for web OTP login.

---

## 6. Frontend login steps

Implemented in `apps/web/app/auth/login/login-form.tsx`:

1. **Step 1 — Phone:** Collect and validate phone; advance to OTP step (OTP field does not block this step).
2. **Step 2 — OTP:** Submit `loginWebSession(phone, otp)` → `POST /api/v2/auth/web/session/otp` with normalized phone.
3. After success: optional workspace picker, `GET /api/v2/auth/workspaces`, then redirect (e.g. `/dashboard` vs `/tours` by role).

---

## Related code

- API: `apps/api/src/modules/auth/auth.controller.ts`, `auth.service.ts`, `dto/phone-session.dto.ts`
- Tenant host: `apps/api/src/common/tenant/tenant-resolver.middleware.ts`, `docs/multi-tenant-subdomain.md`
- Types: `packages/types/src/auth.ts` (`PhoneOtpLoginRequest`)
