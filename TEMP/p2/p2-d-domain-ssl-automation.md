# P2-D — Domain & SSL Automation · Nano-Task Spec (AI Lite v2.2)

```yaml
doc_id: P2-D-DOMAIN-SSL
version: 2.2-nano
nano_tasks: 32
parent_tasks: 16
start: P2-D-N-001
stop: P2-D-N-032
epic: P2-D
priority: P2-core
execute_after: P2-C (recommended — custom_domain gate on domains POST)
execute_before: P2-A
denali_covenant: TEMP/p2/p2-denali-safety.md
language: fa-en-mixed
```

---

## برای AI — 12 قانون (الزامی)

1. **فقط `P2-D-N-001` → `P2-D-N-032` به ترتیب** — jump · skip · merge ممنوع.
2. **هر `[IMPLEMENT]` بلافاصله `[TEST]`** — parent = دو nano پشت سر هم.
3. **فقط §File manifest** — path دیگر = **STOP** و گزارش به Architect.
4. **§Facts frozen + §Copy-paste blocks** — re-explore · redesign · «بهترش کنیم» ممنوع.
5. **`packages/workspaces/denali/**` diff خالی** — VERIFY در N-032.
6. **Super Admin first** — SSL badge در Domains tab · Overview KPI — قبل از Cloudflare واقعی.
7. **Ingress فقط tenant resolve** — Denali catalog · manifest · `/finance/*` دست نخورند.
8. **Surfaces v1:** **`marketing`** · **`portal`** — admin custom host **ممنوع**.
9. **Stub dev حفظ شود:** `PLATFORM_DOMAIN_VERIFY_STUB=pass` · `PLATFORM_SSL_PROVIDER=stub`.
10. **Platform HTTP:** `/platform/v1/*` via `platform-route-registrar.ts` — الگو §Registrar frozen.
11. **Audit outside transaction:** فقط `appendPlatformAuditEventOutsideTx` — §Copy-paste audit helper.
12. **VERIFY قرمز = STOP** — fix همان nano · به nano بعدی نرو.

---

## §North star

> **Super Admin `admin.{PLATFORM_ROOT_DOMAIN}` — Domains tab = single pane.**  
> CNAME target · verify · **SSL status** · expiry.  
> Club content (Denali catalog) = maintenance OK — **Host→tenant + SSL** کافی است.

---

## §File manifest

### Create

```text
apps/api/prisma/migrations/20260621140000_tenant_domains_ssl/migration.sql
apps/api/src/platform/append-platform-audit-event-outside-tx.ts
apps/api/src/platform/lookup-tenant-domain-cname.ts
apps/api/src/platform/ssl/platform-ssl.types.ts
apps/api/src/platform/ssl/platform-ssl-stub.provider.ts
apps/api/src/platform/ssl/platform-ssl-cloudflare.provider.ts
apps/api/src/platform/ssl/create-platform-ssl-provider.ts
apps/api/src/platform/provision-tenant-domain-ssl.ts
apps/api/src/platform/resolve-tenant-from-custom-domain.ts
apps/api/src/platform/count-expiring-domain-ssl.ts
apps/api/src/tenant/resolve-public-ingress-subdomain.ts
apps/api/src/routes/platform/domains-ssl-summary-get.ts
apps/api/src/routes/platform/domains-run-ssl-expiry-check-post.ts
apps/api/test/lookup-tenant-domain-cname.spec.ts
apps/api/test/provision-tenant-domain-ssl.spec.ts
apps/api/test/resolve-tenant-from-custom-domain.spec.ts
apps/api/test/resolve-public-ingress-subdomain.spec.ts
apps/api/test/platform-domains-ssl-summary.spec.ts
apps/api/test/public-tenant-context-custom-domain.spec.ts
apps/web/app/api/platform/domains/ssl-summary/route.ts
apps/web/src/platform/club-detail/domain-ssl-display-badge.ts
apps/web/test/domain-ssl-display-badge.spec.ts
apps/web/test/platform-tab-domains-ssl.spec.ts
```

### Edit (surgical — فقط این فایل‌ها)

```text
apps/api/prisma/schema.prisma
apps/api/src/platform/platform-audit-logger.ts
apps/api/src/platform/platform-domain.repository.ts
apps/api/src/platform/platform-domain.dto.ts
apps/api/src/platform/verify-tenant-domain.ts
apps/api/src/platform/index.ts
apps/api/src/routes/platform/tenants-domains.ts              # verify handler — §Copy-paste verify handler
apps/api/src/tenant/tenant-branding.routes.ts                # import resolve-public-ingress-subdomain
apps/api/src/http/platform-route-registrar.ts
apps/api/src/openapi/dispatch-routes.ts
apps/api/test/verify-tenant-domain.spec.ts
apps/api/test/platform-domain-repository.spec.ts
apps/web/src/platform/club-detail/tab-domains.tsx
apps/web/src/platform/platform-overview-stats.ts
apps/web/src/platform/load-platform-overview-stats.server.ts
apps/web/app/(platform)/platform/page.tsx
apps/web/test/platform-overview-stats.spec.ts                  # extend for ssl field
```

### Forbidden (diff = STOP)

```text
packages/workspaces/denali/**
packages/workspaces/denali/workspace.manifest.json
apps/api/src/http/workspace-http-routes.generated.ts
apps/marketing/**
legacy/**
apps/web/app/api/platform/tenants/[id]/domains/**             # BFF exists — do not duplicate verify BFF
```

---

## §Facts frozen (کد baseline — re-read ممنوع)

| # | Fact | Anchor |
|---|------|--------|
| F1 | `TenantDomain` model exists — **no** `sslStatus` / `sslExpiresAt` columns | `schema.prisma` ~L509–522 |
| F2 | Repository select today: `id` · `tenantId` · `hostname` · `surface` · `status` · `cnameTarget` · `createdAt` · `verifiedAt` | `platform-domain.repository.ts` L5–14 |
| F3 | Create domain → `status: "pending"` — **no** ssl fields set explicitly | repository L48 |
| F4 | `markVerified` → `status: "verified"` + `verifiedAt: now` | repository L68–77 |
| F5 | `verifyTenantDomainCname` sync stub — **no** DNS | `verify-tenant-domain.ts` L16–26 |
| F6 | Verify handler L184–188: **no** `observedCname` → fails prod unless stub env | `tenants-domains.ts` |
| F7 | Surfaces POST: **`marketing`** \| **`portal`** | `create-tenant-domain.schema.ts` L12 |
| F8 | `buildTenantDomainCnameTarget(subdomain, surface)` | `platform-domain.dto.ts` L25–31 |
| F9 | Domains tab: add · list · verify · `data-status` — **no SSL** | `tab-domains.tsx` L104–161 |
| F10 | Public ingress: sync subdomain parse only | `tenant-branding.routes.ts` L42–54 |
| F11 | `/public/tenant-context` → subdomain → `resolvePublicTenantContextBySubdomain` | L232–244 |
| F12 | Platform audit: only `TENANT_*` constants today | `platform-audit-logger.ts` L3–5 |
| F13 | Audit helper **requires** `Prisma.TransactionClient` — routes have **no** tx | `platform-audit-logger.ts` L20–34 |
| F14 | Registrar domain routes already registered | `platform-route-registrar.ts` L20–23 · L71–97 |
| F15 | Verify route pattern: `TENANT_DOMAIN_VERIFY_PATTERN` POST | registrar L71–78 |
| F16 | BFF verify proxy — **reuse** | `apps/web/app/api/platform/tenants/[id]/domains/[domainId]/verify/route.ts` |
| F17 | Overview: 4 StatCards — **no SSL** | `platform/page.tsx` L20–25 |
| F18 | `computePlatformOverviewStats(items, unhealthyCount)` — 2 args today | `platform-overview-stats.ts` L13–16 |
| F19 | P2-C may add `assertTenantPlatformFeature` on domains POST — **ignore if absent** | optional gate |
| F20 | Custom host **not** in `parseMultiLevelTenantHost` → returns `outside_workspace` or `invalid_label` | `tenant-kernel` parser |

---

## §Domain model frozen (Prisma)

Add to model `TenantDomain`:

```prisma
  sslStatus         String    @default("pending") @map("ssl_status")
  sslExpiresAt      DateTime? @map("ssl_expires_at") @db.Timestamptz
  sslLastError      String?   @map("ssl_last_error")
  lastObservedCname String?   @map("last_observed_cname")
```

### sslStatus values (exact strings)

`pending` · `provisioning` · `active` · `failed`

### status vs sslStatus

| Column | Transition |
|--------|------------|
| `status` | `pending` → `verified` (CNAME) — unchanged semantics |
| `sslStatus` | `pending` → `provisioning` → `active` \| `failed` |

**UI «Expired»:** `sslStatus==="active"` AND `sslExpiresAt < now()` — **no DB value `expired`**.

---

## §API surface frozen

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET | `/platform/v1/tenants/:id/domains` | ops auth | existing — DTO extended |
| POST | `/platform/v1/tenants/:id/domains` | write | existing |
| POST | `/platform/v1/tenants/:id/domains/:domainId/verify` | write | **§Copy-paste verify handler** |
| DELETE | `/platform/v1/tenants/:id/domains/:domainId` | write | existing |
| GET | `/platform/v1/domains/ssl-summary` | ops auth (all) | `domains-ssl-summary-get.ts` |
| POST | `/platform/v1/domains/run-ssl-expiry-check` | **owner** | `domains-run-ssl-expiry-check-post.ts` |

### TenantDomainDto (exact JSON keys)

```typescript
type TenantDomainDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hostname: string;
  readonly surface: string;
  readonly status: string;
  readonly cnameTarget: string;
  readonly createdAt: string;
  readonly verifiedAt: string | null;
  readonly sslStatus: "pending" | "provisioning" | "active" | "failed";
  readonly sslExpiresAt: string | null;
  readonly sslLastError: string | null;
};
```

### Verify responses

```typescript
// 200
{ ok: true, domain: TenantDomainDto }

// 422 CNAME fail
{ ok: false, message: string }
```

### ssl-summary

```typescript
{ expiringWithin14Days: number }
```

### run-ssl-expiry-check

```typescript
{ expiring: string[]; audited: number }  // expiring = hostnames
```

---

## §Env frozen

| Variable | Values | When |
|----------|--------|------|
| `PLATFORM_DOMAIN_VERIFY_STUB` | `pass` | Dev/test — CNAME verify always ok |
| `PLATFORM_DOMAIN_DNS_LOOKUP` | `live` (default) \| `off` | `off` → lookup returns null |
| `PLATFORM_SSL_PROVIDER` | `stub` (default) \| `cloudflare` | Factory in `create-platform-ssl-provider.ts` |
| `PLATFORM_SSL_CLOUDFLARE_API_TOKEN` | secret | Required for cloudflare success path |

---

## §Flow frozen

```text
POST verify
  → verifyTenantDomainCnameLive(hostname, cnameTarget)
  → if fail: 422 { ok:false, message }
  → markVerified(domainId, lastObservedCname)
  → appendPlatformAuditEventOutsideTx(DOMAIN_VERIFIED)
  → provisionTenantDomainSsl(...) → ssl active|failed + audit
  → 200 { ok:true, domain: TenantDomainDto }

GET /public/tenant-context Host: custom.example.com
  → resolvePublicIngressSubdomain(host)           # NEW file
       1) resolveSubdomainFromPlatformHost (existing logic)
       2) else resolveTenantFromCustomDomainHost
  → resolvePublicTenantContextBySubdomain (unchanged)
```

---

## Copy-paste: audit outside transaction

Create `apps/api/src/platform/append-platform-audit-event-outside-tx.ts`:

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

Export from `platform/index.ts`.

---

## Copy-paste: repository queries frozen

### `findVerifiedActiveByHostname(hostname: string)`

```typescript
const normalized = hostname.trim().toLowerCase();
const row = await this.prisma.tenantDomain.findFirst({
  where: {
    hostname: normalized,
    status: "verified",
    sslStatus: "active",
  },
  select: {
    tenantId: true,
    surface: true,
    tenant: { select: { subdomain: true } },
  },
});
if (!row) return null;
return {
  tenantId: row.tenantId,
  subdomain: row.tenant.subdomain,
  surface: row.surface,
};
```

### `markVerified(domainId, lastObservedCname?)`

```typescript
return await this.prisma.tenantDomain.update({
  where: { id: domainId },
  data: {
    status: "verified",
    verifiedAt: new Date(),
    ...(lastObservedCname ? { lastObservedCname } : {}),
  },
  select: domainSelect,
});
```

### `countExpiringWithinDays(days)`

```typescript
const cutoff = new Date(Date.now() + days * 86400000);
return this.prisma.tenantDomain.count({
  where: {
    sslStatus: "active",
    sslExpiresAt: { not: null, lte: cutoff, gte: new Date() },
  },
});
```

---

## Copy-paste: verify handler (replace `handlePlatformTenantDomainVerify` body L176–197)

**File:** `apps/api/src/routes/platform/tenants-domains.ts`

```typescript
  const domainRepository = deps.domainRepository ?? new PlatformDomainRepository();
  const domain = await domainRepository.findByIdForTenant(tenantId, domainId);
  if (!domain) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  const { verifyTenantDomainCnameLive } = await import("../../platform/verify-tenant-domain.ts");
  const verification = await verifyTenantDomainCnameLive({
    hostname: domain.hostname,
    cnameTarget: domain.cnameTarget,
  });
  if (!verification.ok) {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, message: verification.message }));
    return;
  }

  const observed = verification.observedCname ?? null;
  const verified = await domainRepository.markVerified(domainId, observed);
  if (!verified) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", code: "NOT_FOUND" }));
    return;
  }

  const { appendPlatformAuditEventOutsideTx } = await import(
    "../../platform/append-platform-audit-event-outside-tx.ts"
  );
  const { PLATFORM_AUDIT_ACTION_DOMAIN_VERIFIED } = await import(
    "../../platform/platform-audit-logger.ts"
  );
  await appendPlatformAuditEventOutsideTx({
    action: PLATFORM_AUDIT_ACTION_DOMAIN_VERIFIED,
    entityType: "tenant_domain",
    entityId: domainId,
    actorId: ctx.actorId,
    metadata: { hostname: domain.hostname, tenantId },
  });

  const { provisionTenantDomainSsl } = await import("../../platform/provision-tenant-domain-ssl.ts");
  const surface = domain.surface === "portal" ? "portal" : "marketing";
  const withSsl = await provisionTenantDomainSsl({
    domainId,
    hostname: domain.hostname,
    surface,
    actorId: ctx.actorId,
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, domain: withSsl }));
```

**Also extend `VerifyTenantDomainResult` in verify-tenant-domain.ts:**

```typescript
export type VerifyTenantDomainResult = {
  readonly ok: boolean;
  readonly message: string;
  readonly observedCname?: string | null;
};
```

Set `observedCname` in `verifyTenantDomainCnameLive` from DNS lookup result.

---

## Copy-paste: `resolve-public-ingress-subdomain.ts`

```typescript
import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";
import { resolveTenantFromCustomDomainHost } from "../platform/resolve-tenant-from-custom-domain";

function readPublicTenantRootDomain(): string {
  const fromTenant = process.env.TENANT_ROOT_DOMAIN?.trim();
  if (fromTenant) return fromTenant;
  const fromPlatform = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  if (fromPlatform) return fromPlatform;
  return "localhost";
}

export function resolveSubdomainFromPlatformHost(host: string): string | null {
  const rootDomain = readPublicTenantRootDomain();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const outcome = parseMultiLevelTenantHost(normalized, rootDomain, reserved);
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    return outcome.subdomain;
  }
  return null;
}

export async function resolvePublicIngressSubdomain(host: string): Promise<string | null> {
  const sync = resolveSubdomainFromPlatformHost(host);
  if (sync) return sync;
  const normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const custom = await resolveTenantFromCustomDomainHost(normalized);
  return custom?.subdomain ?? null;
}
```

**Edit `tenant-branding.routes.ts`:** delete inline `resolvePublicSubdomainFromIngressHost` + `readPublicTenantRootDomain` duplicates · import `resolvePublicIngressSubdomain` · `await` in both public handlers.

---

## Copy-paste: `domain-ssl-display-badge.ts`

```typescript
export type DomainSslBadgeInput = {
  readonly sslStatus: string;
  readonly sslExpiresAt: string | null;
};

export function domainSslDisplayBadge(input: DomainSslBadgeInput): {
  readonly label: string;
  readonly dataSslStatus: string;
} {
  if (input.sslStatus === "active" && input.sslExpiresAt) {
    const expires = Date.parse(input.sslExpiresAt);
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return { label: "Expired", dataSslStatus: "expired" };
    }
  }
  if (
    input.sslStatus === "pending" ||
    input.sslStatus === "provisioning" ||
    input.sslStatus === "active" ||
    input.sslStatus === "failed"
  ) {
    const label = input.sslStatus.charAt(0).toUpperCase() + input.sslStatus.slice(1);
    return { label, dataSslStatus: input.sslStatus };
  }
  return { label: "Unknown", dataSslStatus: "unknown" };
}
```

---

## Copy-paste: Overview page StatCard

Edit `apps/web/app/(platform)/platform/page.tsx` — add 5th card inside grid:

```tsx
<StatCard
  label="SSL expiring (14d)"
  value={stats.sslExpiringWithin14Days}
  testId="data-stat-ssl-expiring"
/>
```

Edit `computePlatformOverviewStats` — add 3rd param `sslExpiringWithin14Days = 0` return field same name.

---

## Copy-paste: API test helpers (inline)

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

// beforeEach in API integration specs:
// process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
// process.env.PLATFORM_DOMAIN_VERIFY_STUB = "pass";
// process.env.PLATFORM_SSL_PROVIDER = "stub";
```

---

## Copy-paste: Registrar (append — do not remove existing domain routes)

```typescript
const DOMAINS_SSL_SUMMARY_PATTERN = /^\/platform\/v1\/domains\/ssl-summary$/;
const DOMAINS_RUN_SSL_EXPIRY_PATTERN = /^\/platform\/v1\/domains\/run-ssl-expiry-check$/;

if (method === "GET" && DOMAINS_SSL_SUMMARY_PATTERN.test(pathname)) {
  const { handlePlatformDomainsSslSummaryGet } = await import(
    "../routes/platform/domains-ssl-summary-get.ts"
  );
  await handlePlatformDomainsSslSummaryGet(req, res);
  return true;
}

if (method === "POST" && DOMAINS_RUN_SSL_EXPIRY_PATTERN.test(pathname)) {
  const { handlePlatformDomainsRunSslExpiryCheckPost } = await import(
    "../routes/platform/domains-run-ssl-expiry-check-post.ts"
  );
  await handlePlatformDomainsRunSslExpiryCheckPost(req, res);
  return true;
}
```

Insert **before** final 404 block in `tryDispatchPlatformRoutes` (before L127).

---

## Copy-paste: Web BFF ssl-summary

```typescript
import { NextResponse } from "next/server";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyPlatformApi(req, "/platform/v1/domains/ssl-summary");
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
```

---

## Parent map

| Parent | Nano | Title |
|--------|------|-------|
| P2-D-T-001 | N-001–002 | Prisma SSL columns + migration |
| P2-D-T-002 | N-003–004 | Audit constants + outside-tx helper |
| P2-D-T-003 | N-005–006 | Repository + DTO SSL fields |
| P2-D-T-004 | N-007–008 | DNS lookup module |
| P2-D-T-005 | N-009–010 | verifyTenantDomainCnameLive (+ result.observedCname) |
| P2-D-T-006 | N-011–012 | SSL provider adapter |
| P2-D-T-007 | N-013–014 | provisionTenantDomainSsl service |
| P2-D-T-008 | N-015–016 | Verify handler full replace (§Copy-paste) |
| P2-D-T-009 | N-017–018 | resolve-public-ingress-subdomain + custom domain |
| P2-D-T-010 | N-019–020 | Public tenant-context custom domain test |
| P2-D-T-011 | N-021–022 | SSL summary + expiry routes |
| P2-D-T-012 | N-023–024 | Overview KPI + BFF |
| P2-D-T-013 | N-025–026 | domain-ssl-display-badge + tab-domains UI |
| P2-D-T-014 | N-027–028 | API integration tests |
| P2-D-T-015 | N-029–030 | Registrar + OpenAPI |
| P2-D-T-016 | N-031–032 | EPIC gate |

---

## NANO TASKS

### P2-D-N-001 [IMPLEMENT] `P2-D-T-001`

- **Deps:** —

**DO THIS:** Edit `schema.prisma` — add 4 columns per §Domain model frozen.

**DO THIS (2):** Create migration `20260621140000_tenant_domains_ssl/migration.sql`:

```sql
ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS ssl_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ssl_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ssl_last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_observed_cname TEXT;

CREATE INDEX IF NOT EXISTS idx_tenant_domains_ssl_expires
  ON tenant_domains (ssl_expires_at)
  WHERE ssl_status = 'active';
```

**DO NOT:** new tables · Denali · admin surface

**NEXT:** N-002 · **STATUS:** ⬜

---

### P2-D-N-002 [TEST] `P2-D-T-001`

- **Deps:** N-001

**VERIFY:**

```bash
grep -q 'sslStatus' apps/api/prisma/schema.prisma && \
grep -q 'ssl_status' apps/api/prisma/migrations/20260621140000_tenant_domains_ssl/migration.sql
```

**NEXT:** N-003 · **STATUS:** ⬜

---

### P2-D-N-003 [IMPLEMENT] `P2-D-T-002`

- **Deps:** N-002

**DO THIS:** Edit `platform-audit-logger.ts` — add:

```typescript
export const PLATFORM_AUDIT_ACTION_DOMAIN_VERIFIED = "DOMAIN_VERIFIED";
export const PLATFORM_AUDIT_ACTION_DOMAIN_SSL_PROVISIONED = "DOMAIN_SSL_PROVISIONED";
export const PLATFORM_AUDIT_ACTION_DOMAIN_SSL_FAILED = "DOMAIN_SSL_FAILED";
export const PLATFORM_AUDIT_ACTION_DOMAIN_SSL_EXPIRING = "DOMAIN_SSL_EXPIRING";
```

**DO THIS (2):** Create `append-platform-audit-event-outside-tx.ts` per §Copy-paste audit outside transaction.

**DO THIS (3):** Export helper from `platform/index.ts`.

**NEXT:** N-004 · **STATUS:** ⬜

---

### P2-D-N-004 [TEST] `P2-D-T-002`

- **Deps:** N-003

**VERIFY:**

```bash
grep -q DOMAIN_VERIFIED apps/api/src/platform/platform-audit-logger.ts && \
test -f apps/api/src/platform/append-platform-audit-event-outside-tx.ts && \
grep -q appendPlatformAuditEventOutsideTx apps/api/src/platform/index.ts
```

**NEXT:** N-005 · **STATUS:** ⬜

---

### P2-D-N-005 [IMPLEMENT] `P2-D-T-003`

- **Deps:** N-004

**DO THIS:** Edit `platform-domain.repository.ts`:

1. Extend `domainSelect` + all methods using it with 4 new fields
2. Change `markVerified(domainId, lastObservedCname?)` per §Copy-paste repository
3. Add `updateSslState` · `findVerifiedActiveByHostname` · `countExpiringWithinDays` · `listExpiringWithinDays` per §Copy-paste

**DO THIS (2):** Edit `platform-domain.dto.ts` — extend `TenantDomainRecord` · `TenantDomainDto` · `toTenantDomainDto`:

```typescript
sslStatus: row.sslStatus,
sslExpiresAt: row.sslExpiresAt?.toISOString() ?? null,
sslLastError: row.sslLastError ?? null,
// do NOT expose lastObservedCname in DTO v1
```

**NEXT:** N-006 · **STATUS:** ⬜

---

### P2-D-N-006 [TEST] `P2-D-T-003`

- **Deps:** N-005

**DO THIS:** Extend `platform-domain-repository.spec.ts` — after create, `toTenantDomainDto(created).sslStatus === "pending"`.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-domain-repository.spec.ts`

**NEXT:** N-007 · **STATUS:** ⬜

---

### P2-D-N-007 [IMPLEMENT] `P2-D-T-004`

- **Deps:** N-006

**DO THIS:** Create `lookup-tenant-domain-cname.ts`:

```typescript
import { resolve } from "node:dns/promises";

export async function lookupTenantDomainCname(hostname: string): Promise<string | null> {
  if (process.env.PLATFORM_DOMAIN_DNS_LOOKUP === "off") return null;
  try {
    const records = await resolve(hostname, "CNAME");
    const first = records[0]?.trim().toLowerCase();
    return first && first.length > 0 ? first.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}
```

**NEXT:** N-008 · **STATUS:** ⬜

---

### P2-D-N-008 [TEST] `P2-D-T-004`

- **Deps:** N-007

**DO THIS:** Create `lookup-tenant-domain-cname.spec.ts` — `PLATFORM_DOMAIN_DNS_LOOKUP=off` → null.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/lookup-tenant-domain-cname.spec.ts`

**NEXT:** N-009 · **STATUS:** ⬜

---

### P2-D-N-009 [IMPLEMENT] `P2-D-T-005`

- **Deps:** N-008

**DO THIS:** Edit `verify-tenant-domain.ts`:

1. Extend `VerifyTenantDomainResult` with optional `observedCname` (§Copy-paste verify handler note)
2. Keep `verifyTenantDomainCname` **byte-identical logic** — only add optional field passthrough when caller sets it
3. Add:

```typescript
export async function verifyTenantDomainCnameLive(input: {
  hostname: string;
  cnameTarget: string;
}): Promise<VerifyTenantDomainResult> {
  const observed = await lookupTenantDomainCname(input.hostname);
  const result = verifyTenantDomainCname({
    hostname: input.hostname,
    cnameTarget: input.cnameTarget,
    observedCname: observed ?? undefined,
  });
  return { ...result, observedCname: observed };
}
```

**DO NOT:** edit `tenants-domains.ts` in this nano — that is N-015

**NEXT:** N-010 · **STATUS:** ⬜

---

### P2-D-N-010 [TEST] `P2-D-T-005`

- **Deps:** N-009

**DO THIS:** Extend `verify-tenant-domain.spec.ts`:

- Existing 2 tests **must still pass**
- New test: stub env + `verifyTenantDomainCnameLive` → `ok === true`

**VERIFY:** `pnpm --filter @apps/api exec node --test test/verify-tenant-domain.spec.ts`

**NEXT:** N-011 · **STATUS:** ⬜

---

### P2-D-N-011 [IMPLEMENT] `P2-D-T-006`

- **Deps:** N-010

**DO THIS:** Create `ssl/platform-ssl.types.ts` · `platform-ssl-stub.provider.ts` · `platform-ssl-cloudflare.provider.ts` · `create-platform-ssl-provider.ts`

**Stub provider frozen:**

```typescript
async provision(): Promise<PlatformSslProvisionResult> {
  return { ok: true, expiresAt: new Date(Date.now() + 90 * 86400000) };
}
```

**Cloudflare provider frozen (v1 placeholder):**

```typescript
async provision(input): Promise<PlatformSslProvisionResult> {
  if (!process.env.PLATFORM_SSL_CLOUDFLARE_API_TOKEN?.trim()) {
    return { ok: false, expiresAt: null, errorMessage: "cloudflare_not_configured" };
  }
  return { ok: true, expiresAt: new Date(Date.now() + 90 * 86400000) };
}
```

**Factory:** `PLATFORM_SSL_PROVIDER` default `"stub"`.

**NEXT:** N-012 · **STATUS:** ⬜

---

### P2-D-N-012 [TEST] `P2-D-T-006`

- **Deps:** N-011

**VERIFY:**

```bash
test -f apps/api/src/platform/ssl/create-platform-ssl-provider.ts && \
grep -q 'PlatformSslProvider' apps/api/src/platform/ssl/platform-ssl.types.ts
```

**NEXT:** N-013 · **STATUS:** ⬜

---

### P2-D-N-013 [IMPLEMENT] `P2-D-T-007`

- **Deps:** N-012

**DO THIS:** Create `provision-tenant-domain-ssl.ts`:

```typescript
export async function provisionTenantDomainSsl(input: {
  domainId: string;
  hostname: string;
  surface: "marketing" | "portal";
  actorId: string;
}): Promise<TenantDomainDto>;
```

**Flow (exact order):**

1. `updateSslState(domainId, { sslStatus: "provisioning", sslLastError: null })`
2. `createPlatformSslProvider().provision({ hostname, surface })`
3. If `result.ok` → `updateSslState({ sslStatus: "active", sslExpiresAt: result.expiresAt })` + `appendPlatformAuditEventOutsideTx(DOMAIN_SSL_PROVISIONED)`
4. Else → `updateSslState({ sslStatus: "failed", sslLastError: result.errorMessage ?? "ssl_failed" })` + audit `DOMAIN_SSL_FAILED`
5. Load row · return `toTenantDomainDto(row)`

**NEXT:** N-014 · **STATUS:** ⬜

---

### P2-D-N-014 [TEST] `P2-D-T-007`

- **Deps:** N-013

**DO THIS:** Create `provision-tenant-domain-ssl.spec.ts` — mock repo + env stub provider → returned DTO `sslStatus === "active"`.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/provision-tenant-domain-ssl.spec.ts`

**NEXT:** N-015 · **STATUS:** ⬜

---

### P2-D-N-015 [IMPLEMENT] `P2-D-T-008`

- **Deps:** N-014

**DO THIS:** Edit `tenants-domains.ts` — replace **`handlePlatformTenantDomainVerify`** function body from domain fetch through response with §Copy-paste verify handler **exactly**.

**DO NOT:** change `handlePlatformTenantsDomains` · DELETE handler · GET list

**NEXT:** N-016 · **STATUS:** ⬜

---

### P2-D-N-016 [TEST] `P2-D-T-008`

- **Deps:** N-015

**VERIFY:**

```bash
grep -q verifyTenantDomainCnameLive apps/api/src/routes/platform/tenants-domains.ts && \
grep -q provisionTenantDomainSsl apps/api/src/routes/platform/tenants-domains.ts && \
grep -q appendPlatformAuditEventOutsideTx apps/api/src/routes/platform/tenants-domains.ts && \
grep -q DOMAIN_VERIFIED apps/api/src/routes/platform/tenants-domains.ts
```

**NEXT:** N-017 · **STATUS:** ⬜

---

### P2-D-N-017 [IMPLEMENT] `P2-D-T-009`

- **Deps:** N-016

**DO THIS:** Create `resolve-tenant-from-custom-domain.ts` — calls `findVerifiedActiveByHostname`.

**DO THIS (2):** Create `resolve-public-ingress-subdomain.ts` per §Copy-paste.

**DO THIS (3):** Edit `tenant-branding.routes.ts`:

- Remove local `readPublicTenantRootDomain` + `resolvePublicSubdomainFromIngressHost` (L30–54)
- Import `{ resolvePublicIngressSubdomain } from "./resolve-public-ingress-subdomain"`
- In `handlePublicTenantBranding` + `handlePublicTenantContext`: `const subdomain = await resolvePublicIngressSubdomain(host);`

**DO NOT:** edit `resolvePublicTenantContextBySubdomain` · Denali imports

**NEXT:** N-018 · **STATUS:** ⬜

---

### P2-D-N-018 [TEST] `P2-D-T-009`

- **Deps:** N-017

**DO THIS:** Create `resolve-public-ingress-subdomain.spec.ts` — mock custom resolver returns subdomain `"acme"` for `www.custom.test`.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/resolve-public-ingress-subdomain.spec.ts test/resolve-tenant-from-custom-domain.spec.ts`

**NEXT:** N-019 · **STATUS:** ⬜

---

### P2-D-N-019 [IMPLEMENT] `P2-D-T-010`

- **Deps:** N-018

**DO THIS:** Create `resolve-tenant-from-custom-domain.spec.ts` (if not created in N-018) + `public-tenant-context-custom-domain.spec.ts`

Test PTC-CD-01: with stub env + seeded domain row (or mocked repo injection via app test hook):

- `GET /public/tenant-context` + `x-forwarded-host: www.custom.test` → 200 when domain verified+active

If DB seed too heavy: **minimum** unit tests on `resolvePublicIngressSubdomain` — document in spec test file comment.

**NEXT:** N-020 · **STATUS:** ⬜

---

### P2-D-N-020 [TEST] `P2-D-T-010`

- **Deps:** N-019

**VERIFY:** `pnpm --filter @apps/api exec node --test test/public-tenant-context-custom-domain.spec.ts`

**NEXT:** N-021 · **STATUS:** ⬜

---

### P2-D-N-021 [IMPLEMENT] `P2-D-T-011`

- **Deps:** N-020

**DO THIS:** Create `count-expiring-domain-ssl.ts` wrapping repository count/list.

**DO THIS (2):** Create `domains-ssl-summary-get.ts`:

- `assertPlatformOpsAuth` only
- `{ expiringWithin14Days: await countExpiringDomainSslWithinDays(14) }`

**DO THIS (3):** Create `domains-run-ssl-expiry-check-post.ts`:

- `assertPlatformOpsOwnerRole`
- For each expiring hostname → `appendPlatformAuditEventOutsideTx(DOMAIN_SSL_EXPIRING)`
- Return `{ expiring: hostnames[], audited: number }`

**NEXT:** N-022 · **STATUS:** ⬜

---

### P2-D-N-022 [TEST] `P2-D-T-011`

- **Deps:** N-021

**DO THIS:** Create `platform-domains-ssl-summary.spec.ts` — PD-SUM-01 no auth 401 · PD-SUM-02 owner 200 + number field.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-domains-ssl-summary.spec.ts`

**NEXT:** N-023 · **STATUS:** ⬜

---

### P2-D-N-023 [IMPLEMENT] `P2-D-T-012`

- **Deps:** N-022

**DO THIS:** Create BFF `apps/web/app/api/platform/domains/ssl-summary/route.ts` per §Copy-paste.

**DO THIS (2):** Edit `platform-overview-stats.ts`:

```typescript
export type PlatformOverviewStats = {
  readonly total: number;
  readonly active: number;
  readonly suspended: number;
  readonly unhealthyCount: number;
  readonly sslExpiringWithin14Days: number;
};

export function computePlatformOverviewStats(
  items: readonly PlatformTenantListItem[],
  unhealthyCount = 0,
  sslExpiringWithin14Days = 0,
): PlatformOverviewStats {
  // existing loop unchanged
  return { total: items.length, active, suspended, unhealthyCount, sslExpiringWithin14Days };
}
```

**DO THIS (3):** Edit `load-platform-overview-stats.server.ts`:

```typescript
const sslUpstream = await proxyPlatformApi(req, "/platform/v1/domains/ssl-summary");
const sslBody = sslUpstream.ok
  ? ((await sslUpstream.json().catch(() => ({}))) as { expiringWithin14Days?: number })
  : {};
const sslExpiringWithin14Days =
  typeof sslBody.expiringWithin14Days === "number" ? sslBody.expiringWithin14Days : 0;
return computePlatformOverviewStats(items, unhealthyCount, sslExpiringWithin14Days);
```

**DO THIS (4):** Edit `platform/page.tsx` — §Copy-paste Overview StatCard.

**NEXT:** N-024 · **STATUS:** ⬜

---

### P2-D-N-024 [TEST] `P2-D-T-012`

- **Deps:** N-023

**VERIFY:**

```bash
grep -q sslExpiringWithin14Days apps/web/src/platform/platform-overview-stats.ts && \
grep -q data-stat-ssl-expiring apps/web/app/\(platform\)/platform/page.tsx && \
test -f apps/web/app/api/platform/domains/ssl-summary/route.ts
```

**NEXT:** N-025 · **STATUS:** ⬜

---

### P2-D-N-025 [IMPLEMENT] `P2-D-T-013`

- **Deps:** N-024

**DO THIS:** Create `domain-ssl-display-badge.ts` per §Copy-paste.

**DO THIS (2):** Edit `tab-domains.tsx`:

1. Extend `TenantDomainRow`:

```typescript
readonly sslStatus: string;
readonly sslExpiresAt: string | null;
readonly sslLastError: string | null;
```

2. Import `domainSslDisplayBadge`
3. In each list item after `data-status`:

```tsx
const badge = domainSslDisplayBadge({ sslStatus: item.sslStatus, sslExpiresAt: item.sslExpiresAt });
<span data-ssl-status={badge.dataSslStatus}>{badge.label}</span>
{item.sslLastError ? <p className="text-xs text-destructive">{item.sslLastError}</p> : null}
```

**DO NOT:** new buttons · denali/ui

**NEXT:** N-026 · **STATUS:** ⬜

---

### P2-D-N-026 [TEST] `P2-D-T-013`

- **Deps:** N-025

**DO THIS:** Create `domain-ssl-display-badge.spec.ts`:

- active + future expiry → `dataSslStatus === "active"`
- active + past expiry → `dataSslStatus === "expired"`

**DO THIS (2):** Create `platform-tab-domains-ssl.spec.ts` — grep `data-ssl-status` in tab-domains.tsx.

**VERIFY:**

```bash
pnpm --filter @apps/web exec node --import tsx --test test/domain-ssl-display-badge.spec.ts test/platform-tab-domains-ssl.spec.ts
```

**NEXT:** N-027 · **STATUS:** ⬜

---

### P2-D-N-027 [IMPLEMENT] `P2-D-T-014`

- **Deps:** N-026

**DO THIS:** Extend `platform-tenants-domains.spec.ts` static checks:

- Source contains `verifyTenantDomainCnameLive`
- Source contains `sslStatus` in dto import path OR grep `toTenantDomainDto`

Optional integration PD-INT-01 with stub env if test DB available.

**NEXT:** N-028 · **STATUS:** ⬜

---

### P2-D-N-028 [TEST] `P2-D-T-014`

- **Deps:** N-027

**VERIFY:**

```bash
pnpm --filter @apps/api exec node --test \
  test/verify-tenant-domain.spec.ts \
  test/provision-tenant-domain-ssl.spec.ts \
  test/platform-domains-ssl-summary.spec.ts \
  test/resolve-public-ingress-subdomain.spec.ts
```

**NEXT:** N-029 · **STATUS:** ⬜

---

### P2-D-N-029 [IMPLEMENT] `P2-D-T-015`

- **Deps:** N-028

**DO THIS:** Add §Copy-paste Registrar blocks to `platform-route-registrar.ts`.

**DO THIS (2):** Add OpenAPI entries in `dispatch-routes.ts` for:

- `GET /platform/v1/domains/ssl-summary`
- `POST /platform/v1/domains/run-ssl-expiry-check`

Mirror existing platform route entry shape (copy from `/platform/v1/audit` entry).

**NEXT:** N-030 · **STATUS:** ⬜

---

### P2-D-N-030 [TEST] `P2-D-T-015`

- **Deps:** N-029

**VERIFY:**

```bash
grep -q 'domains/ssl-summary' apps/api/src/http/platform-route-registrar.ts && \
grep -q 'run-ssl-expiry-check' apps/api/src/openapi/dispatch-routes.ts
```

**NEXT:** N-031 · **STATUS:** ⬜

---

### P2-D-N-031 [IMPLEMENT] `P2-D-T-016`

- **Deps:** N-030

**DO THIS:** Extend `platform-overview-stats.spec.ts` — `computePlatformOverviewStats([], 0, 3).sslExpiringWithin14Days === 3`.

**DO THIS (2):** Add file header to `provision-tenant-domain-ssl.ts`:

```typescript
/** P2-D v1 — synchronous SSL on verify success. Cron deferred to manual run-ssl-expiry-check. */
```

**NEXT:** N-032 · **STATUS:** ⬜

---

### P2-D-N-032 [TEST] `P2-D-T-016` — EPIC gate

- **Deps:** N-031

**VERIFY all:**

```bash
pnpm --filter @apps/api exec node --test \
  test/verify-tenant-domain.spec.ts \
  test/lookup-tenant-domain-cname.spec.ts \
  test/provision-tenant-domain-ssl.spec.ts \
  test/resolve-tenant-from-custom-domain.spec.ts \
  test/resolve-public-ingress-subdomain.spec.ts \
  test/platform-domains-ssl-summary.spec.ts \
  test/platform-domain-repository.spec.ts
pnpm --filter @apps/web exec node --import tsx --test \
  test/domain-ssl-display-badge.spec.ts \
  test/platform-tab-domains-ssl.spec.ts \
  test/platform-overview-stats.spec.ts \
  test/platform-epic-c-boundary.spec.ts
pnpm run guard:import-boundary
git diff --quiet -- packages/workspaces/denali
```

**EPIC exit:**

- [ ] N-001…N-032 Done
- [ ] Verify handler = §Copy-paste block (DNS + audit + SSL)
- [ ] Domains tab `data-ssl-status` badges
- [ ] Overview `data-stat-ssl-expiring`
- [ ] Custom host → `/public/tenant-context` resolves
- [ ] Stub env tests still pass
- [ ] Denali diff empty

**NEXT:** — · **STATUS:** ⬜

---

## §STOP table

| If… | Then… |
|-----|--------|
| Edit `packages/workspaces/denali/**` | **STOP** |
| Edit verify handler before N-013 complete | **STOP** — `provisionTenantDomainSsl` must exist |
| Edit verify handler in N-009 | **STOP** — handler only in N-015 |
| Invent audit via raw SQL | **STOP** — use `appendPlatformAuditEventOutsideTx` |
| Add admin custom domain surface | **STOP** |
| Duplicate verify BFF route | **STOP** — F16 |
| Remove stub env behavior | **STOP** |
| Add cron daemon | **STOP** — manual POST only |
| Expose `lastObservedCname` in public DTO | **STOP** — internal column only |

---

## §Denali vs P2-D (frozen)

| Component | P2-D touches | Denali package |
|-----------|--------------|----------------|
| Domains tab SSL UI | `tab-domains.tsx` | none |
| `tenant_domains` SSL cols | platform DB | none |
| `/public/tenant-context` | ingress subdomain resolve | none |
| `/denali/catalog` handlers | **none** | **no edits** |
| Operator auth on `{club}.admin.*` | **none** | **no edits** |

---

## §Out of scope (defer)

- Full Cloudflare for SaaS API
- ACME / Let's Encrypt direct
- Cron SSL renewal
- Admin-surface custom domains
- WAF / edge rate limits
- Mother site gateway (P2-A)
