# P2-C — Billing & Plans · Nano-Task Spec (AI Lite v2.1)

```yaml
doc_id: P2-C-BILLING-PLANS
version: 2.1-nano
nano_tasks: 32
parent_tasks: 16
start: P2-C-N-001
stop: P2-C-N-032
epic: P2-C
priority: P2-core
execute_after: P2-B (recommended)
execute_before: P2-A
language: fa-en-mixed
```

---

## برای AI — 12 قانون (الزامی)

1. **فقط `P2-C-N-001` → `P2-C-N-032` به ترتیب** — jump · skip · merge ممنوع.
2. **هر `[IMPLEMENT]` بلافاصله `[TEST]`** — parent = دو nano پشت سر هم.
3. **فقط فایل‌های §File manifest** — هر path دیگر = **STOP** و گزارش به Architect.
4. **§Facts frozen + §API surface frozen** — re-explore codebase · redesign · «بهترش کنیم» ممنوع.
5. **`packages/workspaces/denali/**` diff باید خالی بماند** — VERIFY در N-032.
6. **Platform SaaS billing ≠ Denali club finance** — `/finance/*` · `workspace-finance` · `packages/workspaces/denali/src/finance` دست نخورند.
7. **Billing UI فقط Super Admin** (`admin.{PLATFORM_ROOT_DOMAIN}`) — `{club}.admin.*` billing tab **ندارد**.
8. **`app-tour.ir/pricing`** = maintenance (P2-A) — checkout · Stripe · Zarinpal در P2-C **ممنوع**.
9. **Platform HTTP prefix ثابت:** `/platform/v1/*` — registrar در `platform-route-registrar.ts`.
10. **RBAC frozen:** mark-paid + run-past-due = **`assertPlatformOpsOwnerRole`** · PATCH subscription = **`assertPlatformOpsWriteRole`** · GET plans = auth only (support OK).
11. **Response keys دقیقاً §API surface** — `planId` نه `plan_id` در JSON.
12. **VERIFY قرمز = STOP** — fix همان nano · به nano بعدی نرو.

---

## §File manifest

### Create

```text
apps/api/prisma/migrations/20260621130000_platform_plans_subscriptions/migration.sql
apps/api/scripts/seed-platform-plans.ts
apps/api/src/platform/platform-plan.repository.ts
apps/api/src/platform/platform-subscription.repository.ts
apps/api/src/platform/platform-subscription.dto.ts
apps/api/src/platform/platform-plan.dto.ts
apps/api/src/platform/create-tenant-subscription-on-provision.ts
apps/api/src/platform/assert-tenant-platform-feature.ts
apps/api/src/platform/mark-tenant-subscription-paid.ts
apps/api/src/platform/update-tenant-subscription.ts
apps/api/src/platform/update-tenant-subscription.schema.ts
apps/api/src/platform/process-past-due-subscriptions.ts
apps/api/src/routes/platform/plans-list.ts
apps/api/src/routes/platform/tenants-subscription-mark-paid-post.ts
apps/api/src/routes/platform/tenants-subscription-patch.ts
apps/api/src/routes/platform/billing-run-past-due-post.ts
apps/api/test/platform-plan-dto.spec.ts
apps/api/test/platform-tenant-detail-subscription.spec.ts
apps/api/test/assert-tenant-platform-feature.spec.ts
apps/api/test/platform-billing-past-due.spec.ts
apps/api/test/platform-subscription.spec.ts
apps/web/app/api/platform/plans/route.ts
apps/web/app/api/platform/tenants/[id]/subscription/route.ts
apps/web/app/api/platform/tenants/[id]/subscription/mark-paid/route.ts
apps/web/app/api/platform/billing/run-past-due/route.ts
apps/web/src/platform/club-detail/tab-billing.tsx
apps/web/test/platform-club-detail-billing.spec.ts
```

### Edit (surgical — فقط این فایل‌ها)

```text
apps/api/prisma/schema.prisma
apps/api/scripts/db-seed.ts                                    # import + call seedPlatformPlans()
apps/api/src/platform/platform-audit-logger.ts
apps/api/src/platform/platform-tenant-detail.dto.ts
apps/api/src/platform/platform.errors.ts                      # PlatformFeatureForbidden
apps/api/src/platform/provision-tenant-saga.ts                # after step 1 tenant create
apps/api/src/platform/index.ts
apps/api/src/routes/platform/tenants-get.ts
apps/api/src/routes/platform/tenants-domains.ts               # POST only: feature gate
apps/api/src/http/platform-route-registrar.ts
apps/api/src/openapi/dispatch-routes.ts
apps/web/app/(platform)/platform/clubs/[id]/page.tsx          # pass opsRole to client
apps/web/src/platform/club-detail/platform-club-detail.types.ts
apps/web/src/platform/club-detail/platform-club-detail-client.tsx
```

### Forbidden (diff = STOP)

```text
packages/workspaces/denali/**
apps/api/src/workspace-finance/**
apps/marketing/**
legacy/**
apps/api/src/denali-finance/**                                 # deleted tree — do not recreate
```

---

## §Facts frozen (کد فعلی — re-read ممنوع)

| # | Fact | Anchor |
|---|------|--------|
| F1 | **No** `PlatformPlan` · **no** `TenantSubscription` in `schema.prisma` today | `apps/api/prisma/schema.prisma` |
| F2 | Platform SaaS billing **≠** Denali `/finance/*` (manifest routes in workspace) | `workspace.manifest.json` |
| F3 | Tenant suspend (P1): `updatePlatformTenantStatus` + operator block via `assertTenantActiveForOperatorLogin` | `platform-tenant-lifecycle.service.ts` |
| F4 | Provision saga steps today: **1** tenant · **2** branding · **3** surfaces · **4** wizard · **5** audit · **6** owner invite | `provision-tenant-saga.ts` L59–107 |
| F5 | Subscription insert = **new step between 1 and 2** (after `tx.tenant.create`, before `seedTenantBrandingConfig`) | same file |
| F6 | Tenant detail DTO today: `tenant` · `sites` · `ownerInvite` only — add **`subscription`** | `platform-tenant-detail.dto.ts` |
| F7 | Club detail tabs today: `overview` · `sites` · `domains` · `owner` · `actions` — add **`billing`** | `platform-club-detail.types.ts` L21–28 |
| F8 | Club detail page **does not** pass session role today — **must add** `opsRole` prop | `clubs/[id]/page.tsx` L32 |
| F9 | Session payload: `{ phone, role: "owner" \| "admin" \| "support" }` | `build-platform-session-cookie.ts` L4–7 |
| F10 | `assertPlatformOpsWriteRole` — owner/admin write · support read-only | `assert-platform-ops-role.ts` |
| F11 | `assertPlatformOpsOwnerRole` — owner only (pattern: `routes/platform/team.ts`) | `assert-platform-ops-role.ts` |
| F12 | Domains POST handler: auth → tenant exists → **`parseCreateTenantDomainBody`** → create | `tenants-domains.ts` L74–95 |
| F13 | Feature gate goes **after** tenant exists · **before** `parseCreateTenantDomainBody` on POST | same file |
| F14 | BFF pattern: `proxyPlatformApi(req, \`/platform/v1/...\`)` | `tenants/[id]/status/route.ts` |
| F15 | Web client API: `fetchPlatformApi('/tenants/${id}/status')` → `/api/platform/tenants/...` | `platform-api-client.ts` |
| F16 | **Missing subscription row** (legacy P1 tenants): feature check resolves plan **`standard`** from DB — **do not throw only because row missing** | `assert-tenant-platform-feature.ts` |
| F17 | Plan IDs (string PK): **`standard`** · **`enterprise`** only |
| F18 | Subscription status: **`active`** · **`past_due`** · **`canceled`** |
| F19 | v0 payment: manual **mark-paid** only — no payment gateway |
| F20 | past_due + expired `currentPeriodEnd` → suspend via existing `updatePlatformTenantStatus({ status: "suspended" })` |

---

## §Domain model frozen (Prisma — copy exact)

Add to `apps/api/prisma/schema.prisma`:

```prisma
model PlatformPlan {
  id            String   @id                    // "standard" | "enterprise"
  displayName   String   @map("display_name")
  priceMonthly  Int?     @map("price_monthly")
  currency      String   @default("IRR")
  features      Json     @default("{}")
  createdAt     DateTime @default(now()) @map("created_at")
  subscriptions TenantSubscription[]
  @@map("platform_plans")
}

model TenantSubscription {
  tenantId          String    @id @map("tenant_id") @db.Uuid
  planId            String    @map("plan_id")
  status            String    @default("active")
  currentPeriodEnd  DateTime? @map("current_period_end") @db.Timestamptz
  updatedAt         DateTime  @updatedAt @map("updated_at")
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  plan              PlatformPlan @relation(fields: [planId], references: [id])
  @@map("tenant_subscriptions")
}
```

On existing `Tenant` model add one line:

```prisma
  subscription TenantSubscription?
```

### §Features JSON seed (exact bytes)

```json
{"custom_domain": false, "max_operators": 10}
{"custom_domain": true, "max_operators": 100}
```

**v1 code reads only:** `custom_domain` (other keys stored but not enforced yet).

---

## §API surface frozen

| Method | Path | Auth | Handler file |
|--------|------|------|--------------|
| GET | `/platform/v1/plans` | ops auth (all roles) | `plans-list.ts` |
| GET | `/platform/v1/tenants/:id` | ops auth | `tenants-get.ts` (+ subscription field) |
| PATCH | `/platform/v1/tenants/:id/subscription` | write role | `tenants-subscription-patch.ts` |
| POST | `/platform/v1/tenants/:id/subscription/mark-paid` | **owner only** | `tenants-subscription-mark-paid-post.ts` |
| POST | `/platform/v1/billing/run-past-due-check` | **owner only** | `billing-run-past-due-post.ts` |

### JSON shapes (exact property names)

```typescript
type PlatformPlanDto = {
  id: string;
  displayName: string;
  priceMonthly: number | null;
  currency: string;
  features: Record<string, unknown>;
};

type TenantSubscriptionDto = {
  planId: string;
  planDisplayName: string;
  status: "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null; // ISO-8601 or null
};

type PlatformTenantDetailDto = {
  tenant: PlatformTenantDto;
  sites: { marketing: string; portal: string; admin: string };
  ownerInvite: PlatformOwnerInviteSummary | null;
  subscription: TenantSubscriptionDto | null;
};

// GET /plans
{ items: PlatformPlanDto[] }

// mark-paid 200
{ subscription: TenantSubscriptionDto }

// PATCH subscription 200
{ subscription: TenantSubscriptionDto }

// run-past-due 200
{ suspended: string[] }  // tenant UUIDs suspended this run

// feature gate 403
{ error: "forbidden", code: "PLATFORM_FEATURE_FORBIDDEN" }
```

### Registrar regex (add to `platform-route-registrar.ts`)

```typescript
const TENANT_SUBSCRIPTION_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/subscription$/;
const TENANT_SUBSCRIPTION_MARK_PAID_PATTERN =
  /^\/platform\/v1\/tenants\/([^/]+)\/subscription\/mark-paid$/;
const BILLING_RUN_PAST_DUE_PATTERN = /^\/platform\/v1\/billing\/run-past-due-check$/;
```

Dispatch order: match **mark-paid** before **subscription** before **tenant GET** (more specific paths first).

---

## Copy-paste: API test helpers (inline — do not import from P2-B doc)

```typescript
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it, beforeEach } from "node:test";
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

// beforeEach in integration specs:
// process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
// process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
```

---

## Copy-paste: Web BFF route (mirror `status/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const rawBody = await req.text();
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}/subscription`, {
    method: "PATCH",
    body: rawBody,
  });
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
```

Apply same pattern for GET `/plans`, POST `.../mark-paid`, POST `/billing/run-past-due` with correct upstream paths.

---

## Copy-paste: `tab-billing.tsx` fetch paths

```typescript
// List plans (optional — can hardcode select options instead)
await fetchPlatformApi("/plans");

// Change plan
await fetchPlatformApi(`/tenants/${tenantId}/subscription`, {
  method: "PATCH",
  body: JSON.stringify({ planId: "enterprise" }),
});

// Mark paid
await fetchPlatformApi(`/tenants/${tenantId}/subscription/mark-paid`, { method: "POST", body: "{}" });
```

---

## Parent map

| Parent | Nano | Title |
|--------|------|-------|
| P2-C-T-001 | N-001–002 | Prisma schema + migration |
| P2-C-T-002 | N-003–004 | Seed platform plans + db-seed hook |
| P2-C-T-003 | N-005–006 | Audit constants |
| P2-C-T-004 | N-007–008 | Repositories + DTOs |
| P2-C-T-005 | N-009–010 | Provision subscription hook |
| P2-C-T-006 | N-011–012 | Tenant detail enrichment |
| P2-C-T-007 | N-013–014 | GET /platform/v1/plans |
| P2-C-T-008 | N-015–016 | assertTenantPlatformFeature + error class |
| P2-C-T-009 | N-017–018 | Domains POST feature gate |
| P2-C-T-010 | N-019–020 | mark-paid endpoint |
| P2-C-T-011 | N-021–022 | PATCH subscription + schema |
| P2-C-T-012 | N-023–024 | past-due → suspend job |
| P2-C-T-013 | N-025–026 | Registrar + OpenAPI |
| P2-C-T-014 | N-027–028 | API integration specs |
| P2-C-T-015 | N-029–030 | Web BFF + types + page opsRole |
| P2-C-T-016 | N-031–032 | Billing tab UI + EPIC gate |

---

## NANO TASKS

### P2-C-N-001 [IMPLEMENT] `P2-C-T-001`

- **Deps:** —

**DO THIS:** Edit `apps/api/prisma/schema.prisma`:

1. Add models `PlatformPlan` + `TenantSubscription` exactly as §Domain model frozen.
2. On model `Tenant` add: `subscription TenantSubscription?`

**DO THIS (2):** Create `apps/api/prisma/migrations/20260621130000_platform_plans_subscriptions/migration.sql`

- CREATE TABLE `platform_plans` + `tenant_subscriptions`
- FK `tenant_subscriptions.tenant_id` → `tenants.id` ON DELETE CASCADE
- FK `tenant_subscriptions.plan_id` → `platform_plans.id`
- INDEX on `tenant_subscriptions(plan_id)`

**DO NOT:** touch payments · ledger · tour · finance tables · Denali packages

**NEXT:** N-002 · **STATUS:** ⬜

---

### P2-C-N-002 [TEST] `P2-C-T-001`

- **Deps:** N-001

**VERIFY:**

```bash
grep -q 'model PlatformPlan' apps/api/prisma/schema.prisma && \
grep -q 'model TenantSubscription' apps/api/prisma/schema.prisma && \
grep -q 'subscription TenantSubscription' apps/api/prisma/schema.prisma && \
test -f apps/api/prisma/migrations/20260621130000_platform_plans_subscriptions/migration.sql
```

**NEXT:** N-003 · **STATUS:** ⬜

---

### P2-C-N-003 [IMPLEMENT] `P2-C-T-002`

- **Deps:** N-002

**DO THIS:** Create `apps/api/scripts/seed-platform-plans.ts`

Export:

```typescript
export async function seedPlatformPlans(): Promise<void>;
```

Idempotent upsert (Prisma `upsert` or raw ON CONFLICT):

| id | displayName | priceMonthly | features |
|----|-------------|--------------|----------|
| standard | Standard | null | `{"custom_domain":false,"max_operators":10}` |
| enterprise | Enterprise | null | `{"custom_domain":true,"max_operators":100}` |

Use `getPrismaAdmin()` (same pattern as other seed scripts).

**DO THIS (2):** Edit `apps/api/scripts/db-seed.ts` — at end of `main()` before closing:

```typescript
const { seedPlatformPlans } = await import("./seed-platform-plans");
await seedPlatformPlans();
```

**DO NOT:** seed tenant subscriptions in this script

**NEXT:** N-004 · **STATUS:** ⬜

---

### P2-C-N-004 [TEST] `P2-C-T-002`

- **Deps:** N-003

**VERIFY:**

```bash
grep -q 'seedPlatformPlans' apps/api/scripts/seed-platform-plans.ts && \
grep -q 'seedPlatformPlans' apps/api/scripts/db-seed.ts && \
grep -q "'standard'" apps/api/scripts/seed-platform-plans.ts
```

**NEXT:** N-005 · **STATUS:** ⬜

---

### P2-C-N-005 [IMPLEMENT] `P2-C-T-003`

- **Deps:** N-004

**DO THIS:** Edit `apps/api/src/platform/platform-audit-logger.ts` — append exports:

```typescript
export const PLATFORM_AUDIT_ACTION_SUBSCRIPTION_MARKED_PAID = "SUBSCRIPTION_MARKED_PAID";
export const PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PLAN_CHANGED = "SUBSCRIPTION_PLAN_CHANGED";
export const PLATFORM_AUDIT_ACTION_SUBSCRIPTION_PAST_DUE = "SUBSCRIPTION_PAST_DUE";
export const PLATFORM_AUDIT_ACTION_TENANT_SUSPENDED_BILLING = "TENANT_SUSPENDED_BILLING";
```

**DO NOT:** rename existing audit constants

**NEXT:** N-006 · **STATUS:** ⬜

---

### P2-C-N-006 [TEST] `P2-C-T-003`

- **Deps:** N-005

**VERIFY:**

```bash
grep -q SUBSCRIPTION_MARKED_PAID apps/api/src/platform/platform-audit-logger.ts && \
grep -q TENANT_SUSPENDED_BILLING apps/api/src/platform/platform-audit-logger.ts
```

**NEXT:** N-007 · **STATUS:** ⬜

---

### P2-C-N-007 [IMPLEMENT] `P2-C-T-004`

- **Deps:** N-006

**DO THIS — create files:**

**A)** `platform-plan.repository.ts`

```typescript
export class PlatformPlanRepository {
  listAll(): Promise<PlatformPlan[]>;
  getById(id: string): Promise<PlatformPlan | null>;
}
```

**B)** `platform-subscription.repository.ts`

```typescript
export class PlatformSubscriptionRepository {
  getByTenantId(tenantId: string): Promise<(TenantSubscription & { plan: PlatformPlan }) | null>;
  createForTenant(tx: Prisma.TransactionClient, input: { tenantId: string; planId?: string }): Promise<void>;
  updatePlan(tenantId: string, planId: string): Promise<TenantSubscription & { plan: PlatformPlan }>;
  markPaid(tenantId: string): Promise<TenantSubscription & { plan: PlatformPlan }>;
}
```

- `createForTenant`: planId default **`standard`** · status **`active`** · `currentPeriodEnd = now + 30 days`
- `markPaid`: status **`active`** · `currentPeriodEnd = now + 30 days`

**C)** `platform-plan.dto.ts` — `toPlatformPlanDto(row)`

**D)** `platform-subscription.dto.ts` — `toTenantSubscriptionDto(sub, plan)`

**DO THIS (2):** Export new modules from `apps/api/src/platform/index.ts`

**NEXT:** N-008 · **STATUS:** ⬜

---

### P2-C-N-008 [TEST] `P2-C-T-004`

- **Deps:** N-007

**DO THIS:** Create `apps/api/test/platform-plan-dto.spec.ts`

- Import `toPlatformPlanDto`
- Mock row `{ id: "standard", displayName: "Standard", priceMonthly: null, currency: "IRR", features: {} }`
- Assert `dto.id === "standard"` and `dto.displayName === "Standard"`

**VERIFY:**

```bash
pnpm --filter @apps/api exec node --test test/platform-plan-dto.spec.ts
```

**NEXT:** N-009 · **STATUS:** ⬜

---

### P2-C-N-009 [IMPLEMENT] `P2-C-T-005`

- **Deps:** N-008

**DO THIS:** Create `apps/api/src/platform/create-tenant-subscription-on-provision.ts`:

```typescript
export async function createTenantSubscriptionOnProvision(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void>;
```

Call `PlatformSubscriptionRepository.createForTenant(tx, { tenantId })`.

**DO THIS (2):** Edit `provision-tenant-saga.ts` — immediately after step 1 `tx.tenant.create` block (after `const tenant = { id, subdomain, workspaceType }`), **before** step 2 `seedTenantBrandingConfig`:

```typescript
await createTenantSubscriptionOnProvision(tx, tenant.id);
```

**DO NOT:** modify steps 2–6 · TourCreated · workspace-finance · Denali

**NEXT:** N-010 · **STATUS:** ⬜

---

### P2-C-N-010 [TEST] `P2-C-T-005`

- **Deps:** N-009

**VERIFY:**

```bash
grep -q 'createTenantSubscriptionOnProvision' apps/api/src/platform/provision-tenant-saga.ts && \
test -f apps/api/src/platform/create-tenant-subscription-on-provision.ts
```

**NEXT:** N-011 · **STATUS:** ⬜

---

### P2-C-N-011 [IMPLEMENT] `P2-C-T-006`

- **Deps:** N-010

**DO THIS:**

**A)** `platform-tenant-detail.dto.ts` — extend type:

```typescript
readonly subscription: TenantSubscriptionDto | null;
```

**B)** Extend `toPlatformTenantDetailDto` input:

```typescript
input: {
  tenant: PlatformTenantRecord;
  ownerInvite: PlatformOwnerInviteSummary | null;
  subscription: (TenantSubscription & { plan: PlatformPlan }) | null;
}
```

Map with `toTenantSubscriptionDto` when non-null; else `null`.

**C)** Edit `tenants-get.ts` — after tenant load:

```typescript
const subscription = await new PlatformSubscriptionRepository().getByTenantId(tenantId);
// pass to toPlatformTenantDetailDto
```

**NEXT:** N-012 · **STATUS:** ⬜

---

### P2-C-N-012 [TEST] `P2-C-T-006`

- **Deps:** N-011

**DO THIS:** Create `apps/api/test/platform-tenant-detail-subscription.spec.ts`

Unit-test `toPlatformTenantDetailDto` with mocked subscription row planId `"standard"` → output `subscription.planId === "standard"`.

**VERIFY:**

```bash
pnpm --filter @apps/api exec node --test test/platform-tenant-detail-subscription.spec.ts
```

**NEXT:** N-013 · **STATUS:** ⬜

---

### P2-C-N-013 [IMPLEMENT] `P2-C-T-007`

- **Deps:** N-012

**DO THIS:** Create `apps/api/src/routes/platform/plans-list.ts`

Handler flow:

1. `await assertPlatformOpsAuth(req.headers)` — **no** write role check
2. `const plans = await new PlatformPlanRepository().listAll()`
3. `200` + `{ items: plans.map(toPlatformPlanDto) }`
4. Auth errors: same 401 pattern as `tenants-status-patch.ts`

**DO THIS (2):** Register in `platform-route-registrar.ts`:

```typescript
if (method === "GET" && pathname === `${PLATFORM_PREFIX}/plans`) {
  const { handlePlatformPlansList } = await import("../routes/platform/plans-list.ts");
  await handlePlatformPlansList(req, res);
  return true;
}
```

**NEXT:** N-014 · **STATUS:** ⬜

---

### P2-C-N-014 [TEST] `P2-C-T-007`

- **Deps:** N-013

**VERIFY:**

```bash
grep -q "handlePlatformPlansList" apps/api/src/http/platform-route-registrar.ts && \
test -f apps/api/src/routes/platform/plans-list.ts
```

**NEXT:** N-015 · **STATUS:** ⬜

---

### P2-C-N-015 [IMPLEMENT] `P2-C-T-008`

- **Deps:** N-014

**DO THIS:** Edit `apps/api/src/platform/platform.errors.ts` — add:

```typescript
export class PlatformFeatureForbidden extends Error {
  readonly code = "PLATFORM_FEATURE_FORBIDDEN";
}
```

**DO THIS (2):** Create `apps/api/src/platform/assert-tenant-platform-feature.ts`:

```typescript
export async function assertTenantPlatformFeature(tenantId: string, featureKey: string): Promise<void>;
```

Logic (exact):

1. `sub = await repo.getByTenantId(tenantId)`
2. If `sub` → use `sub.plan.features`
3. If `!sub` → load plan **`standard`** via `PlatformPlanRepository.getById("standard")` — if missing throw (seed not run)
4. If `features[featureKey] !== true` → throw `PlatformFeatureForbidden`

**DO NOT:** hardcode enterprise features inline · call Denali finance

**NEXT:** N-016 · **STATUS:** ⬜

---

### P2-C-N-016 [TEST] `P2-C-T-008`

- **Deps:** N-015

**DO THIS:** Create `apps/api/test/assert-tenant-platform-feature.spec.ts`

| Case | Expect |
|------|--------|
| AF-01 | standard plan features → `custom_domain` throws `PlatformFeatureForbidden` |
| AF-02 | enterprise plan features → `custom_domain` resolves (no throw) |

Use mocked repository — no DB required.

**VERIFY:**

```bash
pnpm --filter @apps/api exec node --test test/assert-tenant-platform-feature.spec.ts
```

**NEXT:** N-017 · **STATUS:** ⬜

---

### P2-C-N-017 [IMPLEMENT] `P2-C-T-009`

- **Deps:** N-016

**DO THIS:** Edit `apps/api/src/routes/platform/tenants-domains.ts`

In **POST** branch only, after `tenant` confirmed (L60–65) · **before** `parseCreateTenantDomainBody` (L87):

```typescript
try {
  await assertTenantPlatformFeature(tenantId, "custom_domain");
} catch (err: unknown) {
  if (err instanceof PlatformFeatureForbidden || (err as { code?: string })?.code === "PLATFORM_FEATURE_FORBIDDEN") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FEATURE_FORBIDDEN" }));
    return;
  }
  throw err;
}
```

Import `PlatformFeatureForbidden` from `platform.errors.ts`.

**DO NOT:** gate GET domains list · edit `platform-domain.repository.ts`

**NEXT:** N-018 · **STATUS:** ⬜

---

### P2-C-N-018 [TEST] `P2-C-T-009`

- **Deps:** N-017

**VERIFY:**

```bash
grep -q 'assertTenantPlatformFeature' apps/api/src/routes/platform/tenants-domains.ts && \
grep -q 'PLATFORM_FEATURE_FORBIDDEN' apps/api/src/routes/platform/tenants-domains.ts
```

**NEXT:** N-019 · **STATUS:** ⬜

---

### P2-C-N-019 [IMPLEMENT] `P2-C-T-010`

- **Deps:** N-018

**DO THIS:** Create `mark-tenant-subscription-paid.ts`:

```typescript
export async function markTenantSubscriptionPaid(input: {
  tenantId: string;
  actorId: string;
}): Promise<TenantSubscriptionDto>;
```

Transaction: repo.markPaid + audit `SUBSCRIPTION_MARKED_PAID`.

**DO THIS (2):** Create `tenants-subscription-mark-paid-post.ts`

1. `assertPlatformOpsAuth` → **`assertPlatformOpsOwnerRole(ctx)`** (copy team.ts pattern)
2. Call service
3. `200` `{ subscription: dto }`
4. Missing subscription row → `404 NOT_FOUND`

Route path: `POST /platform/v1/tenants/:tenantId/subscription/mark-paid`

**NEXT:** N-020 · **STATUS:** ⬜

---

### P2-C-N-020 [TEST] `P2-C-T-010`

- **Deps:** N-019

**VERIFY:**

```bash
grep -q 'assertPlatformOpsOwnerRole' apps/api/src/routes/platform/tenants-subscription-mark-paid-post.ts && \
test -f apps/api/src/platform/mark-tenant-subscription-paid.ts
```

**NEXT:** N-021 · **STATUS:** ⬜

---

### P2-C-N-021 [IMPLEMENT] `P2-C-T-011`

- **Deps:** N-020

**DO THIS:** Create `update-tenant-subscription.schema.ts`:

```typescript
export function parseUpdateTenantSubscriptionBody(body: unknown): {
  planId?: "standard" | "enterprise";
  status?: "active" | "past_due" | "canceled";
};
```

Reject unknown planId/status with `PlatformValidation`.

**DO THIS (2):** Create `update-tenant-subscription.ts` + `tenants-subscription-patch.ts`

- Auth: **`assertPlatformOpsWriteRole`** (support → 403)
- Audit: plan change → `SUBSCRIPTION_PLAN_CHANGED` · status `past_due` → `SUBSCRIPTION_PAST_DUE`
- Route: `PATCH /platform/v1/tenants/:tenantId/subscription`
- Response: `{ subscription: TenantSubscriptionDto }`

**NEXT:** N-022 · **STATUS:** ⬜

---

### P2-C-N-022 [TEST] `P2-C-T-011`

- **Deps:** N-021

**VERIFY:**

```bash
test -f apps/api/src/platform/update-tenant-subscription.schema.ts && \
test -f apps/api/src/routes/platform/tenants-subscription-patch.ts
```

**NEXT:** N-023 · **STATUS:** ⬜

---

### P2-C-N-023 [IMPLEMENT] `P2-C-T-012`

- **Deps:** N-022

**DO THIS:** Create `process-past-due-subscriptions.ts`:

```typescript
export async function processPastDueSubscriptions(actorId: string): Promise<{ suspended: string[] }>;
```

For each row where `status === "past_due"` AND `currentPeriodEnd != null` AND `currentPeriodEnd < new Date()`:

- Call `updatePlatformTenantStatus({ tenantId, status: "suspended", actorId })`
- Audit `TENANT_SUSPENDED_BILLING`
- Push tenantId to `suspended[]`

**DO THIS (2):** Create `billing-run-past-due-post.ts`

- **`assertPlatformOpsOwnerRole`**
- POST `/platform/v1/billing/run-past-due-check`
- Body ignored · return `{ suspended }`

**v1:** no cron · manual endpoint only.

**DO NOT:** change `assertTenantActiveForOperatorLogin` (suspend already blocks login)

**NEXT:** N-024 · **STATUS:** ⬜

---

### P2-C-N-024 [TEST] `P2-C-T-012`

- **Deps:** N-023

**DO THIS:** Create `apps/api/test/platform-billing-past-due.spec.ts`

Mock repo returns `[]` → `processPastDueSubscriptions("actor")` → `{ suspended: [] }` (length 0).

**VERIFY:**

```bash
pnpm --filter @apps/api exec node --test test/platform-billing-past-due.spec.ts
```

**NEXT:** N-025 · **STATUS:** ⬜

---

### P2-C-N-025 [IMPLEMENT] `P2-C-T-013`

- **Deps:** N-024

**DO THIS:** Register all routes in `platform-route-registrar.ts` using §Registrar regex:

| Match | Method | Handler import |
|-------|--------|----------------|
| `BILLING_RUN_PAST_DUE_PATTERN` | POST | `billing-run-past-due-post.ts` |
| `TENANT_SUBSCRIPTION_MARK_PAID_PATTERN` | POST | `tenants-subscription-mark-paid-post.ts` |
| `TENANT_SUBSCRIPTION_PATTERN` | PATCH | `tenants-subscription-patch.ts` |
| `${PLATFORM_PREFIX}/plans` | GET | `plans-list.ts` (if missing) |

**DO THIS (2):** Add all 5 paths to `apps/api/src/openapi/dispatch-routes.ts` (mirror existing platform entries).

**NEXT:** N-026 · **STATUS:** ⬜

---

### P2-C-N-026 [TEST] `P2-C-T-013`

- **Deps:** N-025

**VERIFY:**

```bash
grep -q 'TENANT_SUBSCRIPTION_PATTERN' apps/api/src/http/platform-route-registrar.ts && \
grep -q 'run-past-due-check' apps/api/src/http/platform-route-registrar.ts && \
grep -q '/plans' apps/api/src/openapi/dispatch-routes.ts
```

**NEXT:** N-027 · **STATUS:** ⬜

---

### P2-C-N-027 [IMPLEMENT] `P2-C-T-014`

- **Deps:** N-026

**DO THIS:** Create `apps/api/test/platform-subscription.spec.ts` using §Copy-paste helpers.

| Case | Call | Expect |
|------|------|--------|
| PS-01 | GET `/platform/v1/plans` no auth headers | 401 |
| PS-02 | GET `/platform/v1/plans` + `platformOwnerHeaders()` | 200 · `Array.isArray(body.items)` |
| PS-03 | POST `.../subscription/mark-paid` + `platformSupportHeaders()` | 403 |
| PS-04 | PATCH `.../subscription` + `platformSupportHeaders()` | 403 |

Use a known tenant id from test helpers or create via provision mock if available.

**NEXT:** N-028 · **STATUS:** ⬜

---

### P2-C-N-028 [TEST] `P2-C-T-014`

- **Deps:** N-027

**VERIFY:**

```bash
pnpm --filter @apps/api exec node --test test/platform-subscription.spec.ts test/assert-tenant-platform-feature.spec.ts test/platform-billing-past-due.spec.ts
```

**NEXT:** N-029 · **STATUS:** ⬜

---

### P2-C-N-029 [IMPLEMENT] `P2-C-T-015`

- **Deps:** N-028

**DO THIS (A):** Edit `platform-club-detail.types.ts`:

```typescript
readonly subscription: {
  readonly planId: string;
  readonly planDisplayName: string;
  readonly status: string;
  readonly currentPeriodEnd: string | null;
} | null;
```

Add `"billing"` to `PlatformClubDetailTab` union **and** `PLATFORM_CLUB_DETAIL_TABS` array (after `"domains"` recommended).

**DO THIS (B):** Create BFF routes (§Copy-paste Web BFF):

- `apps/web/app/api/platform/plans/route.ts` — GET
- `apps/web/app/api/platform/tenants/[id]/subscription/route.ts` — PATCH
- `apps/web/app/api/platform/tenants/[id]/subscription/mark-paid/route.ts` — POST
- `apps/web/app/api/platform/billing/run-past-due/route.ts` — POST

**DO THIS (C):** Edit `apps/web/app/(platform)/platform/clubs/[id]/page.tsx`:

```typescript
import { readPlatformOpsSessionFromCookies } from "@/platform/read-platform-session.server";

// inside component, before return:
const session = await readPlatformOpsSessionFromCookies();
const opsRole = session?.role ?? "support";

// JSX:
<PlatformClubDetailClient initialDetail={detail} opsRole={opsRole} />
```

**DO THIS (D):** Edit `platform-club-detail-client.tsx`:

- Extend props: `opsRole: "owner" | "admin" | "support"`
- Extend tab state union with `"billing"`
- Add tab button for billing
- `const isOwner = opsRole === "owner";`

**NEXT:** N-030 · **STATUS:** ⬜

---

### P2-C-N-030 [TEST] `P2-C-T-015`

- **Deps:** N-029

**VERIFY:**

```bash
grep -q '"billing"' apps/web/src/platform/club-detail/platform-club-detail.types.ts && \
grep -q 'opsRole' apps/web/app/\(platform\)/platform/clubs/\[id\]/page.tsx && \
test -f apps/web/app/api/platform/plans/route.ts && \
test -f apps/web/app/api/platform/tenants/\[id\]/subscription/mark-paid/route.ts
```

**NEXT:** N-031 · **STATUS:** ⬜

---

### P2-C-N-031 [IMPLEMENT] `P2-C-T-016`

- **Deps:** N-030

**DO THIS:** Create `apps/web/src/platform/club-detail/tab-billing.tsx`

```typescript
"use client";

export type TabBillingProps = {
  readonly tenantId: string;
  readonly subscription: PlatformClubDetail["subscription"];
  readonly isOwner: boolean;
};
```

UI requirements (exact `data-*` for tests):

- Root: `<div data-tab="billing">`
- Show: `planDisplayName` · `status` · `currentPeriodEnd` (or "—" if null)
- If `isOwner === true`:
  - `<select data-billing-plan-select>` values `standard` | `enterprise` — onChange → PATCH subscription
  - `<button type="button" data-billing-mark-paid>` → POST mark-paid → `router.refresh()`
- If `isOwner === false`: **no** select · **no** mark-paid button (read-only)

**DO THIS (2):** Wire in `platform-club-detail-client.tsx`:

```typescript
import { TabBilling } from "./tab-billing";

{tab === "billing" ? (
  <TabBilling
    tenantId={detail.tenant.id}
    subscription={detail.subscription}
    isOwner={opsRole === "owner"}
  />
) : null}
```

After successful PATCH/mark-paid update local `detail.subscription` from response body.

**DO NOT:** import `denali/ui` · payment gateway UI · operator admin billing

**NEXT:** N-032 · **STATUS:** ⬜

---

### P2-C-N-032 [TEST] `P2-C-T-016` — EPIC gate

- **Deps:** N-031

**DO THIS:** Create `apps/web/test/platform-club-detail-billing.spec.ts`

Static grep tests (node:test):

- `tab-billing.tsx` contains `data-tab="billing"`
- contains `data-billing-mark-paid`
- `src/platform` tree has no `denali/ui` import

**VERIFY all (must pass):**

```bash
pnpm --filter @apps/api exec node --test test/platform-subscription.spec.ts test/platform-billing-past-due.spec.ts test/assert-tenant-platform-feature.spec.ts test/platform-plan-dto.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/platform-club-detail-billing.spec.ts test/platform-epic-c-boundary.spec.ts
pnpm run guard:import-boundary
git diff --quiet -- packages/workspaces/denali
```

**EPIC exit checklist:**

- [ ] N-001…N-032 all Done
- [ ] `db:seed` runs `seedPlatformPlans`
- [ ] Provision creates subscription `standard` for every new tenant
- [ ] Super Admin club detail has **billing** tab
- [ ] mark-paid + run-past-due **owner-only** · support gets 403
- [ ] standard tenant blocked on custom domain POST (403 `PLATFORM_FEATURE_FORBIDDEN`)
- [ ] past_due + expired period → suspend via run-past-due-check
- [ ] `/finance/*` routes unchanged · Denali package diff empty

**NEXT:** — · **STATUS:** ⬜

---

## §STOP table

| If you are about to… | Then… |
|----------------------|--------|
| Edit `packages/workspaces/denali/**` | **STOP** — out of epic scope |
| Add billing UI to `{club}.admin.*` | **STOP** — Super Admin only |
| Wire Stripe / Zarinpal / checkout | **STOP** — P2-C v0 manual mark-paid |
| Put billing logic in TourCreated / finance outbox | **STOP** — wrong domain |
| Skip provision subscription hook | **STOP** — every new tenant needs row |
| Reference P2-B doc for test helpers | use §Copy-paste in **this** file |
| Invent new plan ids beyond standard/enterprise | **STOP** — §Facts F17 |
| Throw on missing subscription row in feature gate | **STOP** — use F16 (fallback standard plan) |

---

## §Denali vs Platform billing (frozen)

| | P2-C Platform SaaS | Denali club `/finance/*` |
|--|-------------------|--------------------------|
| Who pays | club → platform (app-tour) | member → club |
| Tables | `platform_plans` · `tenant_subscriptions` | invoices · payments · ledger |
| UI | Super Admin → club → billing tab | operator finance pages |
| Code root | `apps/api/src/platform/*` | `packages/workspaces/denali/src/finance` |

**Do not add platform subscription side effects to TourCreated finance handlers.**

---

## §Out of scope (explicit defer)

- Stripe / Zarinpal / invoice PDF
- Operator-facing billing in club admin
- Automated cron for past-due (v1 = manual POST only)
- Enforcing `max_operators` (stored in JSON only)
- Public pricing checkout page (P2-A maintenance)
