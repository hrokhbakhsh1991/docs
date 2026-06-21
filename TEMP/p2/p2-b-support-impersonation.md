# P2-B — Support Impersonation · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P2-B-SUPPORT-IMPERSONATION
version: 2.0-nano
nano_tasks: 30
parent_tasks: 15
start: P2-B-N-001
stop: P2-B-N-030
epic: P2-B
priority: P2-core
execute_before: P2-A
```

---

## برای AI — 10 قانون (بدون تحلیل سرخود)

1. **فقط `P2-B-N-xxx` به ترتیب** — N-005 قبل از N-004 ممنوع.
2. **`[IMPLEMENT]` قبل از `[TEST]`** — هر parent دو nano.
3. **فقط فایل‌های §File manifest** — فایل دیگر = **STOP**.
4. **§Facts frozen** — re-explore ممنوع · conflict → STOP → Architect.
5. **`packages/workspaces/denali/**` diff باید خالی بماند.**
6. **`assert.ok(true)` ممنوع** — حداقل 2 assert واقعی در هر TEST nano.
7. **VERIFY قرمز → STOP** — nano بعدی ممنوع.
8. **Impersonation target فقط `{club}.admin.{root}`** — portal/marketing ممنوع.
9. **JWT impersonation: mutate → 403 `IMPERSONATION_READ_ONLY`** — حتی اگر `role: owner` در claim.
10. **Platform API prefix:** `/platform/v1/...` — never `/internal/...`.

---

## §File manifest (تنها فایل‌های مجاز)

### Create (new files)

```text
apps/api/src/platform/assert-platform-ops-impersonate-role.ts
apps/api/src/platform/sign-platform-impersonation-session-token.ts
apps/api/src/platform/resolve-impersonation-owner-subject.ts
apps/api/src/platform/start-platform-impersonation.ts
apps/api/src/platform/end-platform-impersonation.ts
apps/api/src/routes/platform/tenants-impersonate-post.ts
apps/api/src/routes/platform/tenants-impersonate-end-post.ts
apps/api/src/identity/impersonation-read-only.error.ts
apps/api/src/identity/assert-operator-impersonation-readonly.ts
apps/api/src/identity/accept-platform-impersonation.ts
apps/api/test/platform-impersonate-role.spec.ts
apps/api/test/sign-platform-impersonation-session-token.spec.ts
apps/api/test/resolve-impersonation-owner-subject.spec.ts
apps/api/test/start-platform-impersonation.spec.ts
apps/api/test/assert-operator-impersonation-readonly.spec.ts
apps/api/test/platform-impersonate.spec.ts
apps/web/app/api/platform/tenants/[id]/impersonate/route.ts
apps/web/app/api/platform/tenants/[id]/impersonate/end/route.ts
apps/web/app/api/auth/platform-impersonate/route.ts
apps/web/app/(app)/auth/platform-impersonate/page.tsx
apps/web/src/platform/club-detail/tab-owner-impersonate.tsx
apps/web/src/auth/build-impersonation-session-cookie.ts
apps/web/app/api/auth/logout/route.ts
apps/web/test/platform-club-detail-impersonate.spec.ts
```

### Edit (existing — surgical only)

```text
apps/api/src/platform/platform-audit-logger.ts          # add 2 constants
apps/api/src/platform/index.ts                          # export new symbols
apps/api/src/http/platform-route-registrar.ts           # 2 routes
apps/api/src/http/bind-request-context.ts               # readonly guard call
apps/api/src/openapi/dispatch-routes.ts                 # 2 paths
apps/api/src/app.ts                                     # POST /auth/accept-platform-impersonation
apps/api/src/middleware/error-interceptor.ts            # map IMPERSONATION_READ_ONLY → 403 (if not mapped)
apps/web/src/platform/club-detail/platform-club-detail-client.tsx
apps/web/src/admin/shell/operator-shell.tsx             # banner + exit
apps/web/src/auth/decode-jwt-payload.ts                 # optional: add claim types only
```

### Forbidden (never touch)

```text
packages/workspaces/denali/**
apps/marketing/**
apps/public/**
```

---

## §Facts frozen

| # | Fact |
|---|------|
| F1 | Impersonate **does not exist** in repo today — zero routes |
| F2 | Super Admin host: `admin.{PLATFORM_ROOT_DOMAIN}` · `apps/web` · `is-platform-admin-host.ts` |
| F3 | Club operator host: `{sub}.{admin}.{root}` · `build-club-site-urls.ts` → `.../auth/login` |
| F4 | Platform auth: `assertPlatformOpsAuth` + `Authorization: Bearer` + `X-Platform-Ops-Phone` |
| F5 | Support role: **403 on platform write** (`assertPlatformOpsWriteRole`) · **allowed to impersonate** (this EPIC) |
| F6 | Platform audit: `appendPlatformAuditEvent(tx, { action, entityType, entityId, actorId, metadata })` |
| F7 | Owner tab today: `platform-club-detail-client.tsx` lines ~156–186 — invite/resend only |
| F8 | Operator cookie name: **`session`** · `SESSION_TOKEN_COOKIE` in `build-session-cookie.ts` |
| F9 | Normal session maxAge cookie: **604800s (7d)** — impersonation cookie **1800s (30m)** |
| F10 | Operator login BFF pattern: `apps/web/app/api/auth/login-web-session/route.ts` |
| F11 | Mutation routes use `runWithHttpRequestContext(..., { rateLimit: "write" })` — guard hooks **here** |
| F12 | Owner row: `user_tenants` · `role = "owner"` · `status = "ACTIVE"` · Prisma model `UserTenant` |
| F13 | Denali `assertDenaliWorkspaceOwner` — **do not edit** — block mutations before handlers |
| F14 | Session JWT sign pattern: copy from `apps/api/src/identity/sign-session-token.ts` |

---

## §Flow frozen (do not redesign)

```text
[Super Admin admin.{root}]
  Owner tab → button data-platform-view-as-club
       → POST /api/platform/tenants/:id/impersonate  (web BFF)
       → POST /platform/v1/tenants/:id/impersonate (API)
       → audit IMPERSONATE_START
       → { sessionToken, exchangePath, expiresAt }

  window.open(`https://{sub}.admin.{root}${exchangePath}?token=${sessionToken}`)

[Club admin host]
  /auth/platform-impersonate?page loads
       → POST /api/auth/platform-impersonate { sessionToken }
       → POST /auth/accept-platform-impersonation (API verify JWT)
       → Set-Cookie session maxAge=1800
       → redirect /dashboard

  Operator shell: data-operator-impersonation-banner
  PATCH/POST/DELETE → 403 IMPERSONATION_READ_ONLY

  Exit → POST impersonate/end + clear cookie + audit IMPERSONATE_END
```

**Response field names (exact):**

```typescript
type StartImpersonationResponse = {
  sessionToken: string;      // NOT "token"
  exchangePath: string;      // always "/auth/platform-impersonate"
  expiresAt: string;         // ISO-8601
};
```

---

## Copy-paste: API test helpers

```typescript
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { createRequestListener } from "../src/app";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

async function platformHttpJson(
  method: "GET" | "POST" | "PATCH",
  path: string,
  opts?: { headers?: Record<string, string>; body?: unknown }
) {
  const listener = createRequestListener({ toursService: createTestToursService() });
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const s = http.createServer(listener);
    s.listen(0, () => {
      const a = s.address();
      if (!a || typeof a === "string") {
        s.close();
        reject(new Error("no addr"));
        return;
      }
      const p = opts?.body ? JSON.stringify(opts.body) : undefined;
      const r = http.request(
        {
          hostname: "127.0.0.1",
          port: a.port,
          path,
          method,
          headers: {
            ...(opts?.headers ?? {}),
            ...(p ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(p)) } : {}),
          },
        },
        (res) => {
          const c: Buffer[] = [];
          res.on("data", (x) => c.push(x as Buffer));
          res.on("end", () => {
            s.close();
            const t = Buffer.concat(c).toString("utf8");
            resolve({ status: res.statusCode ?? 0, body: t ? JSON.parse(t) : {} });
          });
        }
      );
      r.on("error", (e) => {
        s.close();
        reject(e);
      });
      if (p) r.write(p);
      r.end();
    });
  });
}

function platformOwnerHeaders(phone = "+989121234567") {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": phone };
}

function platformSupportHeaders() {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": "+10000000099" };
}
```

**Test env (set in describe beforeEach):**

```typescript
process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
```

---

## Parent map

| Parent | Nano | Title |
|--------|------|-------|
| P2-B-T-001 | N-001–002 | Audit constants |
| P2-B-T-002 | N-003–004 | ImpersonationReadOnlyError |
| P2-B-T-003 | N-005–006 | assertPlatformOpsImpersonateRole |
| P2-B-T-004 | N-007–008 | signPlatformImpersonationSessionToken |
| P2-B-T-005 | N-009–010 | resolveImpersonationOwnerSubject |
| P2-B-T-006 | N-011–012 | startPlatformImpersonation |
| P2-B-T-007 | N-013–014 | endPlatformImpersonation |
| P2-B-T-008 | N-015–016 | Platform HTTP handlers |
| P2-B-T-009 | N-017–018 | Registrar + OpenAPI |
| P2-B-T-010 | N-019–020 | Readonly guard + bind-request-context |
| P2-B-T-011 | N-021–022 | accept-platform-impersonation API |
| P2-B-T-012 | N-023–024 | API integration spec |
| P2-B-T-013 | N-025–026 | Web BFF routes |
| P2-B-T-014 | N-027–028 | Super Admin Owner tab UI |
| P2-B-T-015 | N-029–030 | Operator exchange + banner + EPIC gate |

---

## NANO TASKS

### P2-B-N-001 [IMPLEMENT] `P2-B-T-001`

- **Deps:** —

**DO THIS:** Edit `apps/api/src/platform/platform-audit-logger.ts` — append:

```typescript
export const PLATFORM_AUDIT_ACTION_IMPERSONATE_START = "IMPERSONATE_START";
export const PLATFORM_AUDIT_ACTION_IMPERSONATE_END = "IMPERSONATE_END";
```

**DO NOT:** change `appendPlatformAuditEvent` body

**NEXT:** N-002 · **STATUS:** ⬜

---

### P2-B-N-002 [TEST] `P2-B-T-001`

- **Deps:** N-001

**VERIFY:**

```bash
grep -q 'PLATFORM_AUDIT_ACTION_IMPERSONATE_START' apps/api/src/platform/platform-audit-logger.ts && \
grep -q 'PLATFORM_AUDIT_ACTION_IMPERSONATE_END' apps/api/src/platform/platform-audit-logger.ts
```

**NEXT:** N-003 · **STATUS:** ⬜

---

### P2-B-N-003 [IMPLEMENT] `P2-B-T-002`

- **Deps:** N-002

**DO THIS:** Create `apps/api/src/identity/impersonation-read-only.error.ts`:

```typescript
export const IMPERSONATION_READ_ONLY = "IMPERSONATION_READ_ONLY";

export class ImpersonationReadOnlyError extends Error {
  readonly code = IMPERSONATION_READ_ONLY;
  constructor(message = IMPERSONATION_READ_ONLY) {
    super(message);
    this.name = "ImpersonationReadOnlyError";
  }
}
```

**DO THIS (2):** In `apps/api/src/middleware/error-interceptor.ts` — map `ImpersonationReadOnlyError` → HTTP **403** JSON `{ error: "forbidden", code: "IMPERSONATION_READ_ONLY" }` (same pattern as `PlatformForbidden`).

**NEXT:** N-004 · **STATUS:** ⬜

---

### P2-B-N-004 [TEST] `P2-B-T-002`

- **Deps:** N-003

**Create:** `apps/api/test/impersonation-read-only-error.spec.ts`

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ImpersonationReadOnlyError, IMPERSONATION_READ_ONLY } from "../src/identity/impersonation-read-only.error";

describe("ImpersonationReadOnlyError", () => {
  it("code constant", () => {
    assert.equal(new ImpersonationReadOnlyError().code, IMPERSONATION_READ_ONLY);
  });
  it("name", () => {
    assert.equal(new ImpersonationReadOnlyError().name, "ImpersonationReadOnlyError");
  });
});
```

**VERIFY:** `pnpm --filter @apps/api exec node --test test/impersonation-read-only-error.spec.ts`

**NEXT:** N-005 · **STATUS:** ⬜

---

### P2-B-N-005 [IMPLEMENT] `P2-B-T-003`

- **Deps:** N-004

**DO THIS:** Create `apps/api/src/platform/assert-platform-ops-impersonate-role.ts`:

```typescript
import type { PlatformAuthContext } from "./platform-auth-context.ts";
import { PlatformForbidden } from "./platform.errors.ts";

export function assertPlatformOpsImpersonateRole(ctx: PlatformAuthContext): true {
  if (!ctx?.roles?.length) throw new PlatformForbidden("no roles");
  const allowed = ctx.roles.some((r) => r === "owner" || r === "admin" || r === "support");
  if (!allowed) throw new PlatformForbidden("impersonate forbidden");
  return true;
}
```

Export from `apps/api/src/platform/index.ts`.

**DO NOT:** call `assertPlatformOpsWriteRole`

**NEXT:** N-006 · **STATUS:** ⬜

---

### P2-B-N-006 [TEST] `P2-B-T-003`

- **Deps:** N-005

**Create:** `apps/api/test/platform-impersonate-role.spec.ts` — assert:

- `{ roles: ["support"] }` → returns `true`
- `{ roles: ["guest"] }` → throws `PlatformForbidden`
- `{ roles: [] }` → throws

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-impersonate-role.spec.ts`

**NEXT:** N-007 · **STATUS:** ⬜

---

### P2-B-N-007 [IMPLEMENT] `P2-B-T-004`

- **Deps:** N-006

**DO THIS:** Create `apps/api/src/platform/sign-platform-impersonation-session-token.ts`

Copy private-key loading from `sign-session-token.ts`.

Export:

```typescript
export type PlatformImpersonationSessionClaims = {
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionVersion: number;
  readonly platformImpersonator: string;
};

export async function signPlatformImpersonationSessionToken(
  claims: PlatformImpersonationSessionClaims
): Promise<string>;
```

JWT body claims (**exact keys**):

| key | value |
|-----|--------|
| `sub` | `userId` |
| `tenant_id` | tenant UUID |
| `role` | `"owner"` |
| `sess_ver` | `String(sessionVersion)` |
| `platform_impersonation_readonly` | `true` |
| `platform_impersonator` | ops phone |

**Expiry:** `.setExpirationTime("30m")` — NOT 7d.

Export `resetPlatformImpersonationSessionTokenKeyCacheForTests()`.

**NEXT:** N-008 · **STATUS:** ⬜

---

### P2-B-N-008 [TEST] `P2-B-T-004`

- **Deps:** N-007

**Create:** `apps/api/test/sign-platform-impersonation-session-token.spec.ts`

Use same JWT test key setup as existing session token tests in repo.

**Assert (decode payload base64):**

- `platform_impersonation_readonly === true`
- `exp - iat <= 1800 + 10`

**VERIFY:** `pnpm --filter @apps/api exec node --test test/sign-platform-impersonation-session-token.spec.ts`

**NEXT:** N-009 · **STATUS:** ⬜

---

### P2-B-N-009 [IMPLEMENT] `P2-B-T-005`

- **Deps:** N-008

**DO THIS:** Create `apps/api/src/platform/resolve-impersonation-owner-subject.ts`:

```typescript
export type ImpersonationOwnerSubject = {
  readonly userId: string;
  readonly sessionVersion: number;
};

export async function resolveImpersonationOwnerSubject(
  tenantId: string
): Promise<ImpersonationOwnerSubject | null> {
  const { getPrismaAdmin } = await import("../db/prisma.js");
  const prisma = getPrismaAdmin();
  const row = await prisma.userTenant.findFirst({
    where: { tenantId, role: "owner", status: "ACTIVE" },
    select: { userId: true, sessionVersion: true },
  });
  if (!row) return null;
  return { userId: row.userId, sessionVersion: row.sessionVersion };
}
```

**DO NOT:** import denali · invent userId

**NEXT:** N-010 · **STATUS:** ⬜

---

### P2-B-N-010 [TEST] `P2-B-T-005`

- **Deps:** N-009

**Create:** `apps/api/test/resolve-impersonation-owner-subject.spec.ts`

- Export exists (function typeof `function`)
- When `DATABASE_URL` unset: call returns `Promise` (smoke) OR mock — minimum 2 asserts on exported API

**VERIFY:** `pnpm --filter @apps/api exec node --test test/resolve-impersonation-owner-subject.spec.ts`

**NEXT:** N-011 · **STATUS:** ⬜

---

### P2-B-N-011 [IMPLEMENT] `P2-B-T-006`

- **Deps:** N-010

**DO THIS:** Create `apps/api/src/platform/start-platform-impersonation.ts`

```typescript
export async function startPlatformImpersonation(input: {
  readonly tenantId: string;
  readonly actorId: string;
}): Promise<{ sessionToken: string; exchangePath: string; expiresAt: string }>;
```

**Steps (exact order):**

1. `PlatformTenantRepository.getById(tenantId)` — null → throw `PlatformValidation("TENANT_NOT_FOUND")`
2. `resolveImpersonationOwnerSubject(tenantId)` — null → throw `PlatformValidation("TENANT_OWNER_NOT_READY")`
3. `signPlatformImpersonationSessionToken({ userId, tenantId, sessionVersion, platformImpersonator: actorId })`
4. `getPrismaAdmin().$transaction(tx => appendPlatformAuditEvent(tx, { action: PLATFORM_AUDIT_ACTION_IMPERSONATE_START, entityType: "tenant", entityId: tenantId, actorId, metadata: { tenantId, subdomain: tenant.subdomain } }))`
5. `expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()`
6. Return `{ sessionToken, exchangePath: "/auth/platform-impersonate", expiresAt }`

**DO NOT:** return field named `token` alone · skip audit

**NEXT:** N-012 · **STATUS:** ⬜

---

### P2-B-N-012 [TEST] `P2-B-T-006`

- **Deps:** N-011

**Create:** `apps/api/test/start-platform-impersonation.spec.ts`

Mock `PlatformTenantRepository` + owner resolver if needed.

**Assert:** return object has keys `sessionToken` · `exchangePath` · `expiresAt` (3 asserts minimum).

**VERIFY:** `pnpm --filter @apps/api exec node --test test/start-platform-impersonation.spec.ts`

**NEXT:** N-013 · **STATUS:** ⬜

---

### P2-B-N-013 [IMPLEMENT] `P2-B-T-007`

- **Deps:** N-012

**DO THIS:** Create `apps/api/src/platform/end-platform-impersonation.ts`:

```typescript
export async function endPlatformImpersonation(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly reason: "manual" | "timeout" | "replaced";
}): Promise<void>;
```

Append audit `PLATFORM_AUDIT_ACTION_IMPERSONATE_END` with metadata `{ reason, tenantId }`.

**NEXT:** N-014 · **STATUS:** ⬜

---

### P2-B-N-014 [TEST] `P2-B-T-007`

- **Deps:** N-013

**VERIFY:** `grep -q 'IMPERSONATE_END' apps/api/src/platform/end-platform-impersonation.ts`

**NEXT:** N-015 · **STATUS:** ⬜

---

### P2-B-N-015 [IMPLEMENT] `P2-B-T-008`

- **Deps:** N-014

**DO THIS (A):** `apps/api/src/routes/platform/tenants-impersonate-post.ts`

Pattern: copy structure from `tenants-status-patch.ts` but:

- `assertPlatformOpsImpersonateRole(ctx)` instead of `assertPlatformOpsWriteRole`
- call `startPlatformImpersonation({ tenantId, actorId: ctx.actorId })`
- 200 JSON body = return value

**DO THIS (B):** `apps/api/src/routes/platform/tenants-impersonate-end-post.ts`

- Same auth + `assertPlatformOpsImpersonateRole`
- Body optional `{ reason?: string }` — default `"manual"`
- call `endPlatformImpersonation`

**NEXT:** N-016 · **STATUS:** ⬜

---

### P2-B-N-016 [TEST] `P2-B-T-008`

- **Deps:** N-015

**VERIFY:**

```bash
test -f apps/api/src/routes/platform/tenants-impersonate-post.ts && \
test -f apps/api/src/routes/platform/tenants-impersonate-end-post.ts && \
grep -q 'assertPlatformOpsImpersonateRole' apps/api/src/routes/platform/tenants-impersonate-post.ts && \
grep -q 'startPlatformImpersonation' apps/api/src/routes/platform/tenants-impersonate-post.ts
```

**NEXT:** N-017 · **STATUS:** ⬜

---

### P2-B-N-017 [IMPLEMENT] `P2-B-T-009`

- **Deps:** N-016

**DO THIS:** Edit `apps/api/src/http/platform-route-registrar.ts`

Add patterns **before** final 404 block:

```typescript
const TENANT_IMPERSONATE_END_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/impersonate\/end$/;
const TENANT_IMPERSONATE_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/impersonate$/;
```

| Method | Pattern | Handler |
|--------|---------|---------|
| POST | impersonate/end | `handlePlatformTenantsImpersonateEndPost` |
| POST | impersonate (not /end) | `handlePlatformTenantsImpersonatePost` |

**DO THIS (2):** Add to `apps/api/src/openapi/dispatch-routes.ts`:

```typescript
{ method: "POST", path: "/platform/v1/tenants/{tenantId}/impersonate" },
{ method: "POST", path: "/platform/v1/tenants/{tenantId}/impersonate/end" },
```

**NEXT:** N-018 · **STATUS:** ⬜

---

### P2-B-N-018 [TEST] `P2-B-T-009`

- **Deps:** N-017

**VERIFY:**

```bash
grep -q 'impersonate/end' apps/api/src/http/platform-route-registrar.ts && \
grep -q '/platform/v1/tenants/{tenantId}/impersonate' apps/api/src/openapi/dispatch-routes.ts
```

**NEXT:** N-019 · **STATUS:** ⬜

---

### P2-B-N-019 [IMPLEMENT] `P2-B-T-010`

- **Deps:** N-018

**DO THIS (A):** Create `apps/api/src/identity/assert-operator-impersonation-readonly.ts`

```typescript
import type { IncomingMessage } from "node:http";
import { jwtVerify } from "jose";
import { readSessionCookieToken } from "./parse-session-cookie";
import { ImpersonationReadOnlyError } from "./impersonation-read-only.error";
// reuse readJwtVerifyConfig + loadPublicKey from tenant-kernel (same as parse-jwt-bearer.ts)

export async function assertOperatorImpersonationReadonly(req: IncomingMessage): Promise<void>;
```

Logic:

1. Method = `(req.method ?? "GET").toUpperCase()` — if GET or HEAD → **return** (no-op)
2. Read token from `Authorization: Bearer` OR `readSessionCookieToken(req)`
3. If no JWT → return
4. `jwtVerify` token
5. If payload `platform_impersonation_readonly === true` → throw `ImpersonationReadOnlyError`

**DO THIS (B):** Edit `apps/api/src/http/bind-request-context.ts` — inside `execute()` **before** `consumeTenantRateLimit`:

```typescript
if (options?.rateLimit) {
  await assertOperatorImpersonationReadonly(req);
}
```

**DO NOT:** edit denali manifest

**NEXT:** N-020 · **STATUS:** ⬜

---

### P2-B-N-020 [TEST] `P2-B-T-010`

- **Deps:** N-019

**Create:** `apps/api/test/assert-operator-impersonation-readonly.spec.ts`

Use signed token from N-007 helper in test.

**Assert:**

- PATCH + readonly JWT → rejects / throws `ImpersonationReadOnlyError`
- GET + readonly JWT → resolves (no throw)

**VERIFY:** `pnpm --filter @apps/api exec node --test test/assert-operator-impersonation-readonly.spec.ts`

**NEXT:** N-021 · **STATUS:** ⬜

---

### P2-B-N-021 [IMPLEMENT] `P2-B-T-011`

- **Deps:** N-020

**DO THIS:** Create `apps/api/src/identity/accept-platform-impersonation.ts`

```typescript
export async function acceptPlatformImpersonationSession(
  sessionToken: string
): Promise<{ sessionToken: string }>;
```

1. `jwtVerify(sessionToken, ...)` — invalid → throw `IdentityRequiredError` or 401
2. payload must have `platform_impersonation_readonly === true` — else 403
3. Return `{ sessionToken }` unchanged

**DO THIS (2):** Edit `apps/api/src/app.ts` — add **before** workspace routes:

```typescript
if (method === "POST" && url.pathname === "/auth/accept-platform-impersonation") {
  const { handleAcceptPlatformImpersonation } = await import("./identity/accept-platform-impersonation.js");
  await handleAcceptPlatformImpersonation(req, res);
  return;
}
```

Export `handleAcceptPlatformImpersonation` HTTP handler (read JSON `{ sessionToken }`).

**NEXT:** N-022 · **STATUS:** ⬜

---

### P2-B-N-022 [TEST] `P2-B-T-011`

- **Deps:** N-021

**VERIFY:**

```bash
grep -q 'accept-platform-impersonation' apps/api/src/app.ts && \
test -f apps/api/src/identity/accept-platform-impersonation.ts
```

**NEXT:** N-023 · **STATUS:** ⬜

---

### P2-B-N-023 [IMPLEMENT] `P2-B-T-012`

- **Deps:** N-022

**Create:** `apps/api/test/platform-impersonate.spec.ts`

| Case | Request | Expect |
|------|---------|--------|
| PI-01 | POST impersonate no auth | status 401 |
| PI-02 | POST impersonate support headers invalid tenant UUID | 404 or 422 |
| PI-03 | POST accept impersonation with garbage token | 401 or 403 |

Use helpers from top of this doc.

**NEXT:** N-024 · **STATUS:** ⬜

---

### P2-B-N-024 [TEST] `P2-B-T-012`

- **Deps:** N-023

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-impersonate.spec.ts test/platform-impersonate-role.spec.ts test/assert-operator-impersonation-readonly.spec.ts`

**PASS:** all green

**NEXT:** N-025 · **STATUS:** ⬜

---

### P2-B-N-025 [IMPLEMENT] `P2-B-T-013`

- **Deps:** N-024

**DO THIS (A):** `apps/web/app/api/platform/tenants/[id]/impersonate/route.ts`

```typescript
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}/impersonate`, { method: "POST", body: await req.text() });
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}
```

**DO THIS (B):** `apps/web/app/api/platform/tenants/[id]/impersonate/end/route.ts` — proxy `.../impersonate/end`

**DO THIS (C):** Create `apps/web/src/auth/build-impersonation-session-cookie.ts
apps/web/app/api/auth/logout/route.ts`:

```typescript
export const IMPERSONATION_SESSION_MAX_AGE_SECONDS = 1800;
export function setImpersonationSessionCookieOnResponse(headers: Headers, token: string): void;
```

Copy from `setSessionCookieOnResponse` but `Max-Age=1800`.

**DO THIS (D):** `apps/web/app/api/auth/platform-impersonate/route.ts`

POST body `{ sessionToken: string }`:

1. `fetch(${apiBase}/auth/accept-platform-impersonation, { method:"POST", body: JSON.stringify({ sessionToken }) })`
2. if ok → `setImpersonationSessionCookieOnResponse(res.headers, sessionToken)`
3. return `{ ok: true }`

**DO NOT:** import denali/ui

**NEXT:** N-026 · **STATUS:** ⬜

---

### P2-B-N-026 [TEST] `P2-B-T-013`

- **Deps:** N-025

**VERIFY:**

```bash
test -f apps/web/app/api/platform/tenants/[id]/impersonate/route.ts && \
test -f apps/web/app/api/auth/platform-impersonate/route.ts && \
grep -q 'IMPERSONATION_SESSION_MAX_AGE_SECONDS = 1800' apps/web/src/auth/build-impersonation-session-cookie.ts
apps/web/app/api/auth/logout/route.ts
```

**NEXT:** N-027 · **STATUS:** ⬜

---

### P2-B-N-027 [IMPLEMENT] `P2-B-T-014`

- **Deps:** N-026

**DO THIS (A):** Create `apps/web/src/platform/club-detail/tab-owner-impersonate.tsx`

- `"use client"`
- Props: `{ tenantId: string; adminLoginUrl: string }` — `adminLoginUrl` from `detail.sites.admin`
- Button `data-platform-view-as-club` label `View as club (read-only)`
- On click: confirm `window.confirm(...)` with subdomain warning
- `fetchPlatformApi(\`/tenants/${tenantId}/impersonate\`, { method: "POST" })`
- Parse `{ sessionToken, exchangePath, expiresAt }`
- Build URL: `adminLoginUrl.replace(/\\/auth\\/login\\/?$/, "") + exchangePath + "?token=" + encodeURIComponent(sessionToken)`
- `window.open(url, "_blank", "noopener,noreferrer")`

**DO THIS (B):** Edit `platform-club-detail-client.tsx` Owner tab — add:

```tsx
<TabOwnerImpersonate tenantId={detail.tenant.id} adminLoginUrl={detail.sites.admin} />
```

below resend invite block.

**DO THIS (C):** Create `apps/web/app/(app)/auth/platform-impersonate/page.tsx`

Client page:

1. Read `token` from `useSearchParams()`
2. `fetch("/api/auth/platform-impersonate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ sessionToken: token }) })`
3. On ok → `router.replace("/dashboard")`
4. On fail → show error text

**NEXT:** N-028 · **STATUS:** ⬜

---

### P2-B-N-028 [TEST] `P2-B-T-014`

- **Deps:** N-027

**Create:** `apps/web/test/platform-club-detail-impersonate.spec.ts`

Grep `src/platform` + `app/(platform)` — must contain `data-platform-view-as-club` · must NOT match `denali/ui`.

Run existing: `apps/web/test/platform-epic-c-boundary.spec.ts`

**VERIFY:** `pnpm --filter @apps/web exec node --import tsx --test test/platform-club-detail-impersonate.spec.ts test/platform-epic-c-boundary.spec.ts`

**NEXT:** N-029 · **STATUS:** ⬜

---

### P2-B-N-029 [IMPLEMENT] `P2-B-T-015`

- **Deps:** N-028

**DO THIS (A):** Edit `apps/web/app/(app)/layout.tsx`

After `readOperatorSessionFromCookies()`:

```typescript
import { cookies } from "next/headers";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { decodeJwtPayload } from "@/auth/decode-jwt-payload";

const cookieStore = await cookies();
const rawSession = cookieStore.get(SESSION_TOKEN_COOKIE)?.value ?? "";
const impersonationReadonly =
  decodeJwtPayload(rawSession)?.platform_impersonation_readonly === true;
```

Pass `impersonationReadonly={impersonationReadonly}` to `<OperatorShell ...>`.

**DO THIS (B):** Edit `apps/web/src/admin/shell/operator-shell.tsx`

Add prop:

```typescript
readonly impersonationReadonly?: boolean;
```

When `impersonationReadonly === true` render **above** children:

```tsx
<div data-operator-impersonation-banner role="status">
  <span>نمای پشتیبانی — فقط خواندن — 30 دقیقه</span>
  <button type="button" data-operator-exit-impersonation>
    خروج
  </button>
</div>
```

Exit button (client handler in small `"use client"` subcomponent or inline onClick):

1. `await fetch("/api/auth/logout", { method: "POST" })`
2. `window.location.href = "/auth/login"`

**DO THIS (C):** Create `apps/web/app/api/auth/logout/route.ts`

```typescript
import { NextResponse } from "next/server";
import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res.headers);
  return res;
}
```

**v1 note:** `IMPERSONATE_END` audit from operator exit is **defer** — comment `// TODO P2-B-v1.1 audit END on logout`. EPIC exit does **not** require END audit in v1.

**DO NOT:** import denali/ui · call Denali APIs from banner

**NEXT:** N-030 · **STATUS:** ⬜

---

### P2-B-N-030 [TEST] `P2-B-T-015` — EPIC gate

- **Deps:** N-029

**VERIFY all (any fail → STOP):**

```bash
pnpm --filter @apps/api exec node --test \
  test/impersonation-read-only-error.spec.ts \
  test/platform-impersonate-role.spec.ts \
  test/assert-operator-impersonation-readonly.spec.ts \
  test/platform-impersonate.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/platform-epic-c-boundary.spec.ts \
  test/platform-club-detail-impersonate.spec.ts
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**EPIC exit (all required):**

- [ ] N-001 … N-030 marked Done
- [ ] `data-platform-view-as-club` exists
- [ ] `data-operator-impersonation-banner` exists
- [ ] Impersonation JWT + PATCH → 403 `IMPERSONATION_READ_ONLY`
- [ ] Successful start writes audit `IMPERSONATE_START`
- [ ] `packages/workspaces/denali` — zero diff

**NEXT:** — (P2-B complete) · **STATUS:** ⬜

---

## §STOP table

| Symptom | Action |
|---------|--------|
| Want to edit `packages/workspaces/denali` | **STOP** |
| Want portal/marketing impersonate | **STOP** |
| Want to skip readonly guard | **STOP** |
| Owner not in `user_tenants` | Return `TENANT_OWNER_NOT_READY` — no fake user |
| Tempted new env var | **STOP** — ask Architect |
| Response uses `token` not `sessionToken` | **STOP** — fix to spec |

---

## §Denali (repeat)

Readonly enforced only in `apps/api/src/identity/assert-operator-impersonation-readonly.ts` + `bind-request-context.ts`. Denali package **never edited**.
