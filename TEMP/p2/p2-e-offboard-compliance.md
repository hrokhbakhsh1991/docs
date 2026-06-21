# P2-E — Offboard & Compliance · Nano-Task Spec (AI Lite v2.3)

```yaml
doc_id: P2-E-OFFBOARD-COMPLIANCE
version: 2.3-nano
nano_tasks: 32
parent_tasks: 16
start: P2-E-N-001
stop: P2-E-N-032
epic: P2-E
priority: P2-core
execute_after: P2-D (recommended — optional domain SSL revoke stub on purge)
execute_before: P2-A
denali_covenant: TEMP/p2/p2-denali-safety.md
language: fa-en-mixed
```

---

## برای AI — 12 قانون (الزامی)

1. **فقط `P2-E-N-001` → `P2-E-N-032` به ترتیب** — jump · skip · merge ممنوع.
2. **هر `[IMPLEMENT]` بلافاصله `[TEST]`** — parent = دو nano پشت سر هم.
3. **فقط §File manifest** — path دیگر = **STOP** و گزارش به Architect.
4. **§Facts frozen + §Copy-paste blocks** — re-explore codebase · redesign · «بهترش کنیم» ممنوع.
5. **`packages/workspaces/denali/**` diff خالی** — VERIFY در N-032.
6. **Super Admin first** — Danger zone (Actions tab) · Audit CSV · GDPR zip.
7. **Export/purge = `getPrismaAdmin()` queries** — **never** import `packages/workspaces/denali/**`.
8. **Tours in zip:** `prisma.tour.findMany({ where: { tenantId } })` — field names per §Tour export select frozen.
9. **Operator block:** edit only `assert-tenant-active-for-login.ts` — not Denali middleware.
10. **Owner-only:** offboard · cancel-offboard · export · purge · run-scheduled-deletions · audit CSV.
11. **Audit outside tx:** only `appendPlatformAuditEventOutsideTx` — §Copy-paste (create if P2-D skipped).
12. **VERIFY قرمز = STOP** — fix همان nano · به nano بعدی نرو.

---

## §North star

> **Super Admin lifecycle:** suspend (P1) → **offboard** → GDPR export → scheduled purge.  
> Operator OTP blocked · Denali **package** untouched · tenant **data** may be hard-deleted on purge.

---

## §File manifest

### Create

```text
apps/api/prisma/migrations/20260621150000_tenant_offboarding/migration.sql
apps/api/src/platform/append-platform-audit-event-outside-tx.ts    # skip if already exists (P2-D)
apps/api/src/platform/start-platform-tenant-offboard.ts
apps/api/src/platform/cancel-platform-tenant-offboard.ts
apps/api/src/platform/purge-platform-tenant.ts
apps/api/src/platform/process-scheduled-tenant-deletions.ts
apps/api/src/platform/build-tenant-gdpr-export.ts
apps/api/src/platform/stream-tenant-gdpr-export-zip.ts
apps/api/src/platform/export-platform-audit-csv.ts
apps/api/src/platform/list-platform-audit-events-filtered.ts
apps/api/src/routes/platform/tenants-offboard-post.ts
apps/api/src/routes/platform/tenants-cancel-offboard-post.ts
apps/api/src/routes/platform/tenants-export-post.ts
apps/api/src/routes/platform/tenants-purge-post.ts
apps/api/src/routes/platform/tenants-run-scheduled-deletions-post.ts
apps/api/src/routes/platform/audit-export-get.ts
apps/api/test/start-platform-tenant-offboard.spec.ts
apps/api/test/cancel-platform-tenant-offboard.spec.ts
apps/api/test/build-tenant-gdpr-export.spec.ts
apps/api/test/purge-platform-tenant.spec.ts
apps/api/test/export-platform-audit-csv.spec.ts
apps/api/test/platform-tenant-offboard.integration.spec.ts
apps/web/src/platform/club-detail/tab-actions-danger.tsx
apps/web/src/platform/club-detail/format-offboard-countdown.ts
apps/web/src/platform/club-detail/download-tenant-gdpr-export.ts
apps/web/app/api/platform/tenants/[id]/offboard/route.ts
apps/web/app/api/platform/tenants/[id]/cancel-offboard/route.ts
apps/web/app/api/platform/tenants/[id]/export/route.ts
apps/web/app/api/platform/audit/export/route.ts
apps/web/test/format-offboard-countdown.spec.ts
apps/web/test/tab-actions-danger.spec.ts
apps/web/test/download-tenant-gdpr-export.spec.ts
apps/web/test/platform-audit-export-button.spec.ts
```

### Edit (surgical — فقط این فایل‌ها)

```text
apps/api/package.json
apps/api/prisma/schema.prisma
apps/api/src/platform/platform-audit-logger.ts
apps/api/src/platform/platform-tenant.repository.ts
apps/api/src/platform/platform-tenant.dto.ts
apps/api/src/platform/platform-tenant-detail.dto.ts
apps/api/src/platform/index.ts
apps/api/src/identity/assert-tenant-active-for-login.ts
apps/api/src/routes/platform/tenants-get.ts
apps/api/src/routes/platform/tenants-status-patch.ts
apps/api/src/http/platform-route-registrar.ts
apps/api/src/openapi/dispatch-routes.ts
apps/web/app/(platform)/platform/clubs/[id]/page.tsx          # pass opsRole
apps/web/src/platform/club-detail/platform-club-detail.types.ts
apps/web/src/platform/club-detail/platform-club-detail-client.tsx
apps/web/app/(platform)/platform/audit/page.tsx
apps/web/test/platform-overview-stats.spec.ts                 # only if signature breaks — optional
```

### Forbidden (diff = STOP)

```text
packages/workspaces/denali/**
packages/workspaces/denali/workspace.manifest.json
apps/api/src/http/workspace-http-routes.generated.ts
apps/api/src/platform/update-platform-tenant-status.schema.ts   # do NOT add offboarding enum
apps/marketing/**
legacy/**
```

---

## §Facts frozen (baseline — re-read ممنوع)

| # | Fact | Anchor |
|---|------|--------|
| F1 | Tenant `status` string — values in prod code today: **`active`** · **`suspended`** | `update-platform-tenant-status.schema.ts` L5 |
| F2 | Suspend service bumps `userTenants.sessionVersion` | `platform-tenant-lifecycle.service.ts` L68–72 |
| F3 | Operator login blocks only `status === "suspended"` | `assert-tenant-active-for-login.ts` L19 |
| F4 | Actions tab: Activate + Suspend · **no** danger zone | `platform-club-detail-client.tsx` L188–212 |
| F5 | Club detail page **does not** pass `opsRole` today | `clubs/[id]/page.tsx` L32 |
| F6 | Session role payload: `owner` \| `admin` \| `support` | `build-platform-session-cookie.ts` |
| F7 | `PLATFORM_AUDIT_ACTION_TENANT_DELETED` exists · unused in routes | `platform-audit-logger.ts` L5 |
| F8 | `GET /platform/v1/audit` — no date filter · no CSV | `list-platform-audit-events.ts` |
| F9 | Audit UI: table · **no** download link | `platform/audit/page.tsx` |
| F10 | `PlatformTenantRecord` select **excludes** offboarding dates today | `platform-tenant.repository.ts` L11–17 |
| F11 | Detail DTO: `tenant` · `sites` · `ownerInvite` only | `platform-tenant-detail.dto.ts` L12–16 |
| F12 | `tenant_config` table model `TenantConfig` | `schema.prisma` L321–331 |
| F13 | Tour model: field **`canonical`** (maps `canonical_data`) · **no** `updatedAt` | `schema.prisma` L59–73 |
| F14 | No `archiver` in `@apps/api` deps today | `apps/api/package.json` |
| F15 | No production `tenant.delete` in `src/` before P2-E | phase5-evolution-audit |
| F16 | BFF status PATCH exists — reuse pattern | `tenants/[id]/status/route.ts` |
| F17 | Retention default **30** days — env `PLATFORM_OFFBOARD_RETENTION_DAYS` | frozen |
| F18 | `offboarding` **not** accepted on PATCH `/status` — dedicated POST | frozen |
| F19 | Purge audit **before** delete (tenant row still exists for FK) | §Copy-paste purge |
| F20 | Export isolation: every array item must match `tenantId` | test assert in N-016 |

---

## §Domain model frozen (Prisma)

On `Tenant`:

```prisma
  offboardingStartedAt  DateTime? @map("offboarding_started_at") @db.Timestamptz
  scheduledDeletionAt   DateTime? @map("scheduled_deletion_at") @db.Timestamptz
```

### status values (exact strings after P2-E)

`active` · `suspended` · `offboarding`

### Transition table (do not redesign)

| From | Action | To |
|------|--------|-----|
| `active` \| `suspended` | POST `.../offboard` (owner) | `offboarding` |
| `offboarding` | POST `.../cancel-offboard` (owner) | `active` |
| `offboarding` + retention elapsed | POST `.../purge` (owner) | row deleted |
| `offboarding` + retention elapsed | POST `.../run-scheduled-deletions` | batch purge |
| `offboarding` | PATCH `{ status:"active" }` | **403** `TENANT_OFFBOARDING_USE_CANCEL` |
| `suspended` | PATCH `{ status:"active" }` | `active` (P1 unchanged) |

---

## §API surface frozen

| Method | Path | Auth | Handler file |
|--------|------|------|--------------|
| POST | `/platform/v1/tenants/:id/offboard` | owner | `tenants-offboard-post.ts` |
| POST | `/platform/v1/tenants/:id/cancel-offboard` | owner | `tenants-cancel-offboard-post.ts` |
| POST | `/platform/v1/tenants/:id/export` | owner | `tenants-export-post.ts` → zip stream |
| POST | `/platform/v1/tenants/:id/purge` | owner | `tenants-purge-post.ts` |
| POST | `/platform/v1/tenants/run-scheduled-deletions` | owner | `tenants-run-scheduled-deletions-post.ts` |
| GET | `/platform/v1/audit/export?from=&to=` | owner | `audit-export-get.ts` → CSV |

### Extended detail JSON (exact keys)

```typescript
type PlatformTenantDetailDto = {
  tenant: PlatformTenantDto;
  sites: { marketing: string; portal: string; admin: string };
  ownerInvite: PlatformOwnerInviteSummary | null;
  offboardingStartedAt: string | null;
  scheduledDeletionAt: string | null;
};
```

`PlatformTenantDto.status` may be `"offboarding"` — no separate enum endpoint.

### Zip entry filenames (exact)

`manifest.json` · `tenant.json` · `tenant-configs.json` · `user-tenants.json` · `operator-pending-invites.json` · `tours.json` · `tenant-domains.json` · `audit-events.json` · `platform-audit-events.json`

---

## §Env frozen

| Variable | Default |
|----------|---------|
| `PLATFORM_OFFBOARD_RETENTION_DAYS` | `30` |
| `PLATFORM_AUDIT_EXPORT_MAX_ROWS` | `10000` |

---

## §Flow frozen

```text
[Actions tab]
  status !== offboarding → Suspend/Activate (P1) + (owner) Danger zone offboard button
  status === offboarding → TabActionsDanger only (hide Suspend/Activate)
  Export → POST export → browser download .zip

[Operator OTP]
  suspended OR offboarding → TenantSuspendedForLoginError

[Purge]
  appendPlatformAuditEventOutsideTx(TENANT_DELETED) → prisma.tenant.delete → invalidateTenantRegistryCache
```

---

## Copy-paste: API test helpers (inline — do not reference other specs)

```typescript
import assert from "node:assert/strict";
import http from "node:http";
import { beforeEach, describe, it } from "node:test";
import { createRequestListener } from "../src/app";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

async function platformHttpJson(
  method: "GET" | "POST" | "PATCH" | "DELETE",
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

// beforeEach:
// process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
// process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
```

---

## Copy-paste: appendPlatformAuditEventOutsideTx

```typescript
import { getPrismaAdmin } from "../db/prisma";
import {
  appendPlatformAuditEvent,
  type AppendPlatformAuditEventInput,
} from "./platform-audit-logger";

export async function appendPlatformAuditEventOutsideTx(
  input: AppendPlatformAuditEventInput
): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.$transaction(async (tx) => {
    await appendPlatformAuditEvent(tx, input);
  });
}
```

---

## Copy-paste: audit constants

```typescript
export const PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_STARTED = "TENANT_OFFBOARDING_STARTED";
export const PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_CANCELED = "TENANT_OFFBOARDING_CANCELED";
export const PLATFORM_AUDIT_ACTION_TENANT_EXPORT_REQUESTED = "TENANT_EXPORT_REQUESTED";
// PLATFORM_AUDIT_ACTION_TENANT_DELETED already at L5
```

---

## Copy-paste: platform-tenant.repository.ts tenantSelect

Extend `tenantSelect` and `PlatformTenantRecord`:

```typescript
export type PlatformTenantRecord = {
  readonly id: string;
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly offboardingStartedAt: Date | null;
  readonly scheduledDeletionAt: Date | null;
};

const tenantSelect = {
  id: true,
  subdomain: true,
  workspaceType: true,
  status: true,
  createdAt: true,
  offboardingStartedAt: true,
  scheduledDeletionAt: true,
} as const;
```

---

## Copy-paste: toPlatformTenantDetailDto

```typescript
export function toPlatformTenantDetailDto(input: {
  tenant: PlatformTenantRecord;
  ownerInvite: PlatformOwnerInviteSummary | null;
}): PlatformTenantDetailDto {
  return {
    tenant: toPlatformTenantDto(input.tenant),
    sites: buildClubSiteUrls(input.tenant.subdomain),
    ownerInvite: input.ownerInvite,
    offboardingStartedAt: input.tenant.offboardingStartedAt?.toISOString() ?? null,
    scheduledDeletionAt: input.tenant.scheduledDeletionAt?.toISOString() ?? null,
  };
}
```

---

## Copy-paste: assertTenantActiveForOperatorLogin

Replace lines 17–21 in `assert-tenant-active-for-login.ts`:

```typescript
  const status = await resolveStatus(tenantId);
  if (status === "suspended" || status === "offboarding") {
    throw new TenantSuspendedForLoginError();
  }
```

---

## Copy-paste: startPlatformTenantOffboard (full file body)

See `start-platform-tenant-offboard.ts` — use imports:

- `getPrismaAdmin` from `../db/prisma`
- `PlatformTenantRepository`
- `appendPlatformAuditEvent` + `PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_STARTED`
- `invalidateTenantRegistryCache`

Logic per §Transition table · retention from env · `sessionVersion++` · return `PlatformTenantRecord | null`.

---

## Copy-paste: cancelPlatformTenantOffboard (full)

```typescript
export async function cancelPlatformTenantOffboard(input: {
  tenantId: string;
  actorId: string;
}): Promise<PlatformTenantRecord | null> {
  const prisma = getPrismaAdmin();
  const existing = await new PlatformTenantRepository().getById(input.tenantId);
  if (!existing || existing.status !== "offboarding") return null;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        status: "active",
        offboardingStartedAt: null,
        scheduledDeletionAt: null,
      },
      select: tenantSelect,
    });
    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_TENANT_OFFBOARDING_CANCELED,
      entityType: "tenant",
      entityId: row.id,
      actorId: input.actorId,
      metadata: {},
    });
    return row;
  });

  invalidateTenantRegistryCache(updated.id, updated.subdomain);
  return updated;
}
```

Import `tenantSelect` via shared export from repository or duplicate select object **identical** to repository.

---

## Copy-paste: §Tour export select (Prisma — exact)

```typescript
await prisma.tour.findMany({
  where: { tenantId },
  select: {
    id: true,
    tenantId: true,
    canonical: true,
    title: true,
    publishStatus: true,
    publishedAt: true,
    createdAt: true,
  },
});
```

---

## Copy-paste: buildTenantGdprExport queries

```typescript
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
if (!tenant) throw new PlatformValidation("tenant not found");

const [tenantConfigs, userTenants, operatorPendingInvites, tours, tenantDomains, auditEvents] =
  await Promise.all([
    prisma.tenantConfig.findMany({ where: { tenantId } }),
    prisma.userTenant.findMany({ where: { tenantId } }),
    prisma.operatorPendingInvite.findMany({ where: { tenantId } }),
    prisma.tour.findMany({ where: { tenantId }, select: { id: true, tenantId: true, canonical: true, title: true, publishStatus: true, publishedAt: true, createdAt: true } }),
    prisma.tenantDomain.findMany({ where: { tenantId } }),
    prisma.auditEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
  ]);

const platformAuditEvents = await prisma.platformAuditEvent.findMany({
  where: {
    OR: [
      { entityType: "tenant", entityId: tenantId },
      { metadata: { path: ["tenantId"], equals: tenantId } },
    ],
  },
  orderBy: { createdAt: "asc" },
});
```

---

## Copy-paste: streamTenantGdprExportZip

Add to `apps/api/package.json`: `"archiver": "^7.0.1"`

```typescript
import archiver from "archiver";
import type { ServerResponse } from "node:http";

export async function streamTenantGdprExportZip(
  res: ServerResponse,
  bundle: TenantGdprExportBundle
): Promise<void> {
  const tenantId = String(bundle.manifest.tenantId ?? "unknown");
  return new Promise((resolve, reject) => {
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="tenant-${tenantId}-gdpr-export.zip"`,
    });
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.on("end", () => resolve());
    archive.pipe(res);
    const files: Array<[string, unknown]> = [
      ["manifest.json", bundle.manifest],
      ["tenant.json", bundle.tenant],
      ["tenant-configs.json", bundle.tenantConfigs],
      ["user-tenants.json", bundle.userTenants],
      ["operator-pending-invites.json", bundle.operatorPendingInvites],
      ["tours.json", bundle.tours],
      ["tenant-domains.json", bundle.tenantDomains],
      ["audit-events.json", bundle.auditEvents],
      ["platform-audit-events.json", bundle.platformAuditEvents],
    ];
    for (const [name, data] of files) {
      archive.append(JSON.stringify(data, null, 2), { name });
    }
    void archive.finalize();
  });
}
```

---

## Copy-paste: purgePlatformTenant

```typescript
export async function purgePlatformTenant(input: {
  tenantId: string;
  actorId: string;
}): Promise<boolean> {
  const prisma = getPrismaAdmin();
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant || tenant.status !== "offboarding") return false;
  if (!tenant.scheduledDeletionAt || tenant.scheduledDeletionAt > new Date()) return false;

  await appendPlatformAuditEventOutsideTx({
    action: PLATFORM_AUDIT_ACTION_TENANT_DELETED,
    entityType: "tenant",
    entityId: input.tenantId,
    actorId: input.actorId,
    metadata: { subdomain: tenant.subdomain, purgedAt: new Date().toISOString() },
  });

  await prisma.tenant.delete({ where: { id: input.tenantId } });
  invalidateTenantRegistryCache(input.tenantId, tenant.subdomain);
  return true;
}
```

---

## Copy-paste: tenants-status-patch guard

Insert after tenant loaded · before `updatePlatformTenantStatus`:

```typescript
if (existing.status === "offboarding" && body.status === "active") {
  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "forbidden", code: "TENANT_OFFBOARDING_USE_CANCEL" }));
  return;
}
```

Load `existing` via `repository.getById(tenantId)` before update call.

---

## Copy-paste: tenants-offboard-post.ts handler

```typescript
export async function handlePlatformTenantsOffboardPost(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
    assertPlatformOpsOwnerRole(ctx);
  } catch (err: unknown) {
    /* same 401/403 pattern as tenants-status-patch.ts */
  }

  const updated = await startPlatformTenantOffboard({ tenantId, actorId: ctx.actorId });
  if (!updated) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ tenant: toPlatformTenantDto(updated) }));
}
```

---

## Copy-paste: tenants-export-post.ts handler

```typescript
export async function handlePlatformTenantsExportPost(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string
): Promise<void> {
  let ctx;
  try {
    ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
    assertPlatformOpsOwnerRole(ctx);
  } catch (err: unknown) {
    /* 401/403 */
  }

  await appendPlatformAuditEventOutsideTx({
    action: PLATFORM_AUDIT_ACTION_TENANT_EXPORT_REQUESTED,
    entityType: "tenant",
    entityId: tenantId,
    actorId: ctx.actorId,
    metadata: {},
  });

  const bundle = await buildTenantGdprExport(tenantId);
  await streamTenantGdprExportZip(res, bundle);
}
```

---

## Copy-paste: Registrar (insert before `TENANT_BY_ID_PATTERN` GET block)

```typescript
const TENANT_OFFBOARD_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/offboard$/;
const TENANT_CANCEL_OFFBOARD_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/cancel-offboard$/;
const TENANT_EXPORT_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/export$/;
const TENANT_PURGE_PATTERN = /^\/platform\/v1\/tenants\/([^/]+)\/purge$/;
const TENANT_RUN_SCHEDULED_DELETIONS_PATTERN = /^\/platform\/v1\/tenants\/run-scheduled-deletions$/;
const AUDIT_EXPORT_PATTERN = /^\/platform\/v1\/audit\/export$/;

const offboardMatch = pathname.match(TENANT_OFFBOARD_PATTERN);
if (method === "POST" && offboardMatch) {
  const { handlePlatformTenantsOffboardPost } = await import("../routes/platform/tenants-offboard-post.ts");
  await handlePlatformTenantsOffboardPost(req, res, offboardMatch[1] ?? "");
  return true;
}
// ... repeat for cancel-offboard, export, purge, run-scheduled-deletions, audit export GET
```

---

## Copy-paste: Web BFF offboard (mirror status route)

```typescript
import { NextResponse } from "next/server";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}/offboard`, {
    method: "POST",
    body: "{}",
  });
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
```

---

## Copy-paste: Web BFF export (binary zip)

```typescript
export async function POST(req: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}/export`, {
    method: "POST",
    body: "{}",
  });
  const buffer = await upstream.arrayBuffer();
  const headers = new Headers();
  const cd = upstream.headers.get("content-disposition");
  const ct = upstream.headers.get("content-type");
  if (cd) headers.set("Content-Disposition", cd);
  headers.set("Content-Type", ct ?? "application/zip");
  return new Response(buffer, { status: upstream.status, headers });
}
```

---

## Copy-paste: download-tenant-gdpr-export.ts

```typescript
import { fetchPlatformApi } from "../platform-api-client";

export async function downloadTenantGdprExport(tenantId: string): Promise<void> {
  const response = await fetchPlatformApi(`/tenants/${tenantId}/export`, { method: "POST", body: "{}" });
  if (!response.ok) throw new Error("export_failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tenant-${tenantId}-gdpr-export.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

---

## Copy-paste: formatOffboardCountdown

```typescript
export function formatOffboardCountdown(scheduledDeletionAt: string | null): string {
  if (!scheduledDeletionAt) return "—";
  const ms = Date.parse(scheduledDeletionAt) - Date.now();
  if (Number.isNaN(ms)) return "—";
  if (ms <= 0) return "Eligible for purge";
  const days = Math.ceil(ms / 86400000);
  return `${days} day(s) until scheduled deletion`;
}
```

---

## Copy-paste: tab-actions-danger.tsx UI rules

| Condition | Render |
|-----------|--------|
| `!isOwner` | `<p data-danger-owner-only>Owner only</p>` — no buttons |
| `isOwner && status !== "offboarding"` | `<button data-offboard-start>` — `confirm()` then `onOffboard()` |
| `isOwner && status === "offboarding"` | `<span data-offboard-countdown>` · `<button data-offboard-cancel>` · `<button data-export-tenant>` |

Root element: `<div data-danger-zone className="mt-4 space-y-3 rounded-lg border border-destructive/40 p-4">`

---

## Copy-paste: platform-club-detail-client.tsx Actions tab

Replace L188–212 block:

```typescript
      {tab === "actions" ? (
        <div className="space-y-4">
          {detail.tenant.status !== "offboarding" ? (
            <div className="flex flex-wrap gap-3">
              {/* keep existing Activate / Suspend buttons unchanged */}
            </div>
          ) : null}
          <TabActionsDanger
            tenantId={detail.tenant.id}
            status={detail.tenant.status}
            scheduledDeletionAt={detail.scheduledDeletionAt ?? null}
            isOwner={opsRole === "owner"}
            busy={busy}
            onOffboard={async () => { /* POST offboard · update detail · refresh */ }}
            onCancelOffboard={async () => { /* POST cancel-offboard */ }}
            onExport={async () => { await downloadTenantGdprExport(detail.tenant.id); }}
          />
        </div>
      ) : null}
```

Add prop `opsRole: "owner" | "admin" | "support"` to `PlatformClubDetailClientProps`.

---

## Copy-paste: clubs/[id]/page.tsx opsRole

```typescript
import { readPlatformOpsSessionFromCookies } from "@/platform/read-platform-session.server";

const session = await readPlatformOpsSessionFromCookies();
const opsRole = session?.role ?? "support";

<PlatformClubDetailClient initialDetail={detail} opsRole={opsRole} />
```

---

## Copy-paste: platform-club-detail.types.ts

```typescript
export type PlatformClubDetail = {
  readonly tenant: { /* existing fields */ };
  readonly sites: { /* existing */ };
  readonly ownerInvite: { /* existing */ } | null;
  readonly offboardingStartedAt: string | null;
  readonly scheduledDeletionAt: string | null;
};
```

Mapper `loadPlatformClubDetailFromResponse` passes through API fields when present · default `null`.

---

## Copy-paste: audit page download link

```tsx
<a
  href="/api/platform/audit/export?from=1970-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.999Z"
  data-audit-export-download
  className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm"
>
  Download CSV
</a>
```

Place inside header row above table in `platform/audit/page.tsx`.

---

## Parent map

| Parent | Nano | Title |
|--------|------|-------|
| P2-E-T-001 | N-001–002 | Prisma offboarding + migration |
| P2-E-T-002 | N-003–004 | Audit constants + outside-tx helper |
| P2-E-T-003 | N-005–006 | Repository select + detail DTO dates |
| P2-E-T-004 | N-007–008 | startPlatformTenantOffboard |
| P2-E-T-005 | N-009–010 | cancelPlatformTenantOffboard |
| P2-E-T-006 | N-011–012 | Operator login block |
| P2-E-T-007 | N-013–014 | POST offboard route |
| P2-E-T-008 | N-015–016 | cancel-offboard route + status guard |
| P2-E-T-009 | N-017–018 | buildTenantGdprExport + archiver dep |
| P2-E-T-010 | N-019–020 | stream zip + POST export |
| P2-E-T-011 | N-021–022 | purge + POST purge route |
| P2-E-T-012 | N-023–024 | scheduled deletions + audit CSV API |
| P2-E-T-013 | N-025–026 | Danger zone UI + BFF + page opsRole |
| P2-E-T-014 | N-027–028 | Audit page CSV link + BFF |
| P2-E-T-015 | N-029–030 | Registrar + OpenAPI |
| P2-E-T-016 | N-031–032 | EPIC gate |

---

## NANO TASKS

### P2-E-N-001 [IMPLEMENT] `P2-E-T-001`

- **Deps:** —

**DO THIS:** Edit `schema.prisma` — add `offboardingStartedAt` · `scheduledDeletionAt` on `Tenant`.

**DO THIS (2):** Create `migrations/20260621150000_tenant_offboarding/migration.sql`:

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS offboarding_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_scheduled_deletion
  ON tenants (scheduled_deletion_at)
  WHERE status = 'offboarding';
```

**DO NOT:** edit `update-platform-tenant-status.schema.ts`

**NEXT:** N-002 · **STATUS:** ⬜

---

### P2-E-N-002 [TEST] `P2-E-T-001`

- **Deps:** N-001

**VERIFY:**

```bash
grep -q offboardingStartedAt apps/api/prisma/schema.prisma && \
test -f apps/api/prisma/migrations/20260621150000_tenant_offboarding/migration.sql
```

**NEXT:** N-003 · **STATUS:** ⬜

---

### P2-E-N-003 [IMPLEMENT] `P2-E-T-002`

- **Deps:** N-002

**DO THIS:** Append §Copy-paste audit constants.

**DO THIS (2):** Create `append-platform-audit-event-outside-tx.ts` if missing — §Copy-paste.

**DO THIS (3):** Export from `platform/index.ts`.

**NEXT:** N-004 · **STATUS:** ⬜

---

### P2-E-N-004 [TEST] `P2-E-T-002`

- **Deps:** N-003

**VERIFY:**

```bash
grep -q TENANT_EXPORT_REQUESTED apps/api/src/platform/platform-audit-logger.ts && \
test -f apps/api/src/platform/append-platform-audit-event-outside-tx.ts
```

**NEXT:** N-005 · **STATUS:** ⬜

---

### P2-E-N-005 [IMPLEMENT] `P2-E-T-003`

- **Deps:** N-004

**DO THIS:** Edit `platform-tenant.repository.ts` — §Copy-paste tenantSelect + `PlatformTenantRecord`.

**DO THIS (2):** Edit `platform-tenant-detail.dto.ts` — extend type + §Copy-paste `toPlatformTenantDetailDto`.

**DO THIS (3):** Edit `platform-club-detail.types.ts` — §Copy-paste types · edit `load-platform-club-detail.server.ts` to pass dates (default null if absent).

**NEXT:** N-006 · **STATUS:** ⬜

---

### P2-E-N-006 [TEST] `P2-E-T-003`

- **Deps:** N-005

**VERIFY:**

```bash
grep -q scheduledDeletionAt apps/api/src/platform/platform-tenant.repository.ts && \
grep -q scheduledDeletionAt apps/api/src/platform/platform-tenant-detail.dto.ts
```

**NEXT:** N-007 · **STATUS:** ⬜

---

### P2-E-N-007 [IMPLEMENT] `P2-E-T-004`

- **Deps:** N-006

**DO THIS:** Create `start-platform-tenant-offboard.ts` — full logic §Copy-paste startPlatformTenantOffboard section · export `tenantSelect` from repository **or** import repository class only.

**NEXT:** N-008 · **STATUS:** ⬜

---

### P2-E-N-008 [TEST] `P2-E-T-004`

- **Deps:** N-007

**DO THIS:** Create `start-platform-tenant-offboard.spec.ts` — mock · assert status `"offboarding"`.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/start-platform-tenant-offboard.spec.ts`

**NEXT:** N-009 · **STATUS:** ⬜

---

### P2-E-N-009 [IMPLEMENT] `P2-E-T-005`

- **Deps:** N-008

**DO THIS:** Create `cancel-platform-tenant-offboard.ts` — §Copy-paste cancelPlatformTenantOffboard.

**NEXT:** N-010 · **STATUS:** ⬜

---

### P2-E-N-010 [TEST] `P2-E-T-005`

- **Deps:** N-009

**DO THIS:** Create `cancel-platform-tenant-offboard.spec.ts` — from offboarding → active.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/cancel-platform-tenant-offboard.spec.ts`

**NEXT:** N-011 · **STATUS:** ⬜

---

### P2-E-N-011 [IMPLEMENT] `P2-E-T-006`

- **Deps:** N-010

**DO THIS:** Edit `assert-tenant-active-for-login.ts` — §Copy-paste assertTenantActiveForOperatorLogin.

**NEXT:** N-012 · **STATUS:** ⬜

---

### P2-E-N-012 [TEST] `P2-E-T-006`

- **Deps:** N-011

**VERIFY:** `grep -q offboarding apps/api/src/identity/assert-tenant-active-for-login.ts`

**NEXT:** N-013 · **STATUS:** ⬜

---

### P2-E-N-013 [IMPLEMENT] `P2-E-T-007`

- **Deps:** N-012

**DO THIS:** Create `tenants-offboard-post.ts` — §Copy-paste handler.

**NEXT:** N-014 · **STATUS:** ⬜

---

### P2-E-N-014 [TEST] `P2-E-T-007`

- **Deps:** N-013

**VERIFY:**

```bash
grep -q assertPlatformOpsOwnerRole apps/api/src/routes/platform/tenants-offboard-post.ts && \
grep -q startPlatformTenantOffboard apps/api/src/routes/platform/tenants-offboard-post.ts
```

**NEXT:** N-015 · **STATUS:** ⬜

---

### P2-E-N-015 [IMPLEMENT] `P2-E-T-008`

- **Deps:** N-014

**DO THIS:** Create `tenants-cancel-offboard-post.ts` — mirror offboard handler · call `cancelPlatformTenantOffboard`.

**DO THIS (2):** Edit `tenants-status-patch.ts` — load existing tenant · §Copy-paste guard · pass `existing` status check before update.

**NEXT:** N-016 · **STATUS:** ⬜

---

### P2-E-N-016 [TEST] `P2-E-T-008`

- **Deps:** N-015

**VERIFY:**

```bash
grep -q TENANT_OFFBOARDING_USE_CANCEL apps/api/src/routes/platform/tenants-status-patch.ts && \
test -f apps/api/src/routes/platform/tenants-cancel-offboard-post.ts
```

**NEXT:** N-017 · **STATUS:** ⬜

---

### P2-E-N-017 [IMPLEMENT] `P2-E-T-009`

- **Deps:** N-016

**DO THIS:** Add `"archiver": "^7.0.1"` to `apps/api/package.json`.

**DO THIS (2):** Create `build-tenant-gdpr-export.ts` — §Copy-paste queries + manifest object:

```typescript
manifest: {
  exportVersion: "p2-e-v1",
  tenantId,
  subdomain: tenant.subdomain,
  exportedAt: new Date().toISOString(),
}
```

**NEXT:** N-018 · **STATUS:** ⬜

---

### P2-E-N-018 [TEST] `P2-E-T-009`

- **Deps:** N-017

**DO THIS:** Create `build-tenant-gdpr-export.spec.ts` — assert every tour `tenantId === tenantId` · zero other tenant ids.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/build-tenant-gdpr-export.spec.ts`

**NEXT:** N-019 · **STATUS:** ⬜

---

### P2-E-N-019 [IMPLEMENT] `P2-E-T-010`

- **Deps:** N-018

**DO THIS:** Create `stream-tenant-gdpr-export-zip.ts` — §Copy-paste.

**DO THIS (2):** Create `tenants-export-post.ts` — §Copy-paste handler.

**NEXT:** N-020 · **STATUS:** ⬜

---

### P2-E-N-020 [TEST] `P2-E-T-010`

- **Deps:** N-019

**VERIFY:**

```bash
grep -q application/zip apps/api/src/platform/stream-tenant-gdpr-export-zip.ts && \
grep -q buildTenantGdprExport apps/api/src/routes/platform/tenants-export-post.ts
```

**NEXT:** N-021 · **STATUS:** ⬜

---

### P2-E-N-021 [IMPLEMENT] `P2-E-T-011`

- **Deps:** N-020

**DO THIS:** Create `purge-platform-tenant.ts` — §Copy-paste.

**DO THIS (2):** Create `tenants-purge-post.ts`:

- Owner only
- `purgePlatformTenant` → 200 `{ deleted: true }` · 403 if retention not met · 404 not found/offboarding

**NEXT:** N-022 · **STATUS:** ⬜

---

### P2-E-N-022 [TEST] `P2-E-T-011`

- **Deps:** N-021

**DO THIS:** Create `purge-platform-tenant.spec.ts`.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/purge-platform-tenant.spec.ts`

**NEXT:** N-023 · **STATUS:** ⬜

---

### P2-E-N-023 [IMPLEMENT] `P2-E-T-012`

- **Deps:** N-022

**DO THIS:** Create `process-scheduled-tenant-deletions.ts`:

```typescript
export async function processScheduledTenantDeletions(actorId: string): Promise<{ purged: string[] }> {
  const prisma = getPrismaAdmin();
  const due = await prisma.tenant.findMany({
    where: { status: "offboarding", scheduledDeletionAt: { lte: new Date() } },
    select: { id: true },
  });
  const purged: string[] = [];
  for (const row of due) {
    if (await purgePlatformTenant({ tenantId: row.id, actorId })) purged.push(row.id);
  }
  return { purged };
}
```

**DO THIS (2):** Create `tenants-run-scheduled-deletions-post.ts` — owner · `{ purged }`.

**DO THIS (3):** Create `list-platform-audit-events-filtered.ts` + `export-platform-audit-csv.ts` + `audit-export-get.ts` — CSV owner-only.

**NEXT:** N-024 · **STATUS:** ⬜

---

### P2-E-N-024 [TEST] `P2-E-T-012`

- **Deps:** N-023

**DO THIS:** Create `export-platform-audit-csv.spec.ts` — header + 1 row.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/export-platform-audit-csv.spec.ts`

**NEXT:** N-025 · **STATUS:** ⬜

---

### P2-E-N-025 [IMPLEMENT] `P2-E-T-013`

- **Deps:** N-024

**DO THIS:** Create `format-offboard-countdown.ts` · `tab-actions-danger.tsx` · `download-tenant-gdpr-export.ts` per §Copy-paste.

**DO THIS (2):** Edit `platform-club-detail-client.tsx` — §Copy-paste Actions tab · add `opsRole` prop.

**DO THIS (3):** Edit `clubs/[id]/page.tsx` — §Copy-paste opsRole.

**DO THIS (4):** Create BFF: `offboard/route.ts` · `cancel-offboard/route.ts` · `export/route.ts` (binary §Copy-paste).

**NEXT:** N-026 · **STATUS:** ⬜

---

### P2-E-N-026 [TEST] `P2-E-T-013`

- **Deps:** N-025

**VERIFY:**

```bash
grep -q data-danger-zone apps/web/src/platform/club-detail/tab-actions-danger.tsx && \
grep -q opsRole apps/web/app/\(platform\)/platform/clubs/\[id\]/page.tsx && \
test -f apps/web/src/platform/club-detail/download-tenant-gdpr-export.ts
pnpm --filter @apps/web exec node --import tsx --test test/format-offboard-countdown.spec.ts test/tab-actions-danger.spec.ts
```

**NEXT:** N-027 · **STATUS:** ⬜

---

### P2-E-N-027 [IMPLEMENT] `P2-E-T-014`

- **Deps:** N-026

**DO THIS:** Create `apps/web/app/api/platform/audit/export/route.ts` — GET proxy · forward `content-type: text/csv`.

**DO THIS (2):** Edit `platform/audit/page.tsx` — §Copy-paste download link.

**NEXT:** N-028 · **STATUS:** ⬜

---

### P2-E-N-028 [TEST] `P2-E-T-014`

- **Deps:** N-027

**DO THIS:** Create `platform-audit-export-button.spec.ts`.

**VERIFY:** `pnpm --filter @apps/web exec node --import tsx --test test/platform-audit-export-button.spec.ts`

**NEXT:** N-029 · **STATUS:** ⬜

---

### P2-E-N-029 [IMPLEMENT] `P2-E-T-015`

- **Deps:** N-028

**DO THIS:** Register §Copy-paste Registrar patterns in `platform-route-registrar.ts`.

**DO THIS (2):** Add 6 paths to `openapi/dispatch-routes.ts`.

**NEXT:** N-030 · **STATUS:** ⬜

---

### P2-E-N-030 [TEST] `P2-E-T-015`

- **Deps:** N-029

**VERIFY:**

```bash
grep -q TENANT_OFFBOARD_PATTERN apps/api/src/http/platform-route-registrar.ts && \
grep -q audit/export apps/api/src/openapi/dispatch-routes.ts
```

**NEXT:** N-031 · **STATUS:** ⬜

---

### P2-E-N-031 [IMPLEMENT] `P2-E-T-016`

- **Deps:** N-030

**DO THIS:** Create `platform-tenant-offboard.integration.spec.ts`:

| ID | Call | Expect |
|----|------|--------|
| PE-01 | POST offboard + support headers | 403 |
| PE-02 | POST offboard + owner headers | 200 · tenant.status offboarding |
| PE-03 | GET audit/export + support | 403 |

**NEXT:** N-032 · **STATUS:** ⬜

---

### P2-E-N-032 [TEST] `P2-E-T-016` — EPIC gate

- **Deps:** N-031

**VERIFY all:**

```bash
pnpm --filter @apps/api exec node --test \
  test/start-platform-tenant-offboard.spec.ts \
  test/cancel-platform-tenant-offboard.spec.ts \
  test/build-tenant-gdpr-export.spec.ts \
  test/purge-platform-tenant.spec.ts \
  test/export-platform-audit-csv.spec.ts \
  test/platform-tenant-offboard.integration.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/format-offboard-countdown.spec.ts \
  test/tab-actions-danger.spec.ts \
  test/download-tenant-gdpr-export.spec.ts \
  test/platform-audit-export-button.spec.ts \
  test/platform-epic-c-boundary.spec.ts
pnpm run guard:import-boundary
git diff --quiet -- packages/workspaces/denali
```

**EPIC exit:**

- [ ] N-001…N-032 Done
- [ ] Danger zone offboard + countdown + export download
- [ ] Operator blocked on offboarding
- [ ] GDPR zip single-tenant test green
- [ ] Audit CSV link works (API owner enforced)
- [ ] Purge + TENANT_DELETED audit
- [ ] Denali diff empty

**NEXT:** — · **STATUS:** ⬜

---

## §STOP table

| If… | Then… |
|-----|--------|
| Edit `packages/workspaces/denali/**` | **STOP** |
| Add `offboarding` to `platformTenantStatusSchema` | **STOP** |
| PATCH active from offboarding | **STOP** — cancel-offboard only |
| Purge before `scheduledDeletionAt` | **STOP** |
| Import denali export module | **STOP** |
| Use `ScopedTourRepository` for GDPR export | **STOP** — admin prisma only |
| Reference P2-D/P2-C doc for test helpers | use §Copy-paste in **this** file |
| Skip `opsRole` on club detail page | **STOP** — owner gating breaks |
| Return export as JSON not zip stream | **STOP** |

---

## §Denali impact (frozen)

| Layer | P2-E | Denali package |
|-------|------|----------------|
| Danger zone UI | `tab-actions-danger.tsx` | none |
| Tour rows in zip | prisma read | no import |
| Purge cascade | DB delete | no code change |
| Other tenants | unaffected | unaffected |

---

## §Out of scope (defer)

- Cron scheduled purge
- Stripe cancel on offboard (P2-C)
- Public maintenance auto (P2-A)
- Legal hold / anonymized export modes
- Impersonate during offboard (P2-B)
