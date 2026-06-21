# P6-0 — Host & subdomain routing

```yaml
epic: P6-0
nanos: 8
priority: 1
blocks: P6-1
apps: [marketing, portal, web]
```

## Goal

Three apps on **distinct subdomains** resolve the **same club tenant**. Without this, catalog and register flows fail even when code is correct.

---

## Host map (frozen)

| App | Dev | Prod |
| --- | --- | ---- |
| Marketing | `shop.{club}.localhost:3002` | `https://shop.{club}.{root}` |
| Portal | `{club}.localhost:3003` | `https://{club}.portal.{root}` |
| Admin | `{club}.localhost:3000` | `https://{club}.admin.{root}` |

**CTA bridge:** marketing strips `shop.` → portal host (see `resolvePortalPublicBaseUrl`).

**Smoke club (dev):** `operator` label → tenant `…000014` (or first customer seed id).

---

## Nanos

### P6-0-N-001 — Host map runbook

**Do:** Create `docs/phase-19/p6/runbooks/host-subdomain-map.md` — dev + prod table, env vars, ingress `x-forwarded-host`.

**Verify:** doc review · linked from umbrella

---

### P6-0-N-002 — tenant-context parity spec

**Do:** Spec asserting marketing, portal, admin BFF resolve same `tenantId` for equivalent club hosts.

**Files:** `apps/api/test/p6-host-tenant-parity.spec.ts` (new)

**Verify:** green

---

### P6-0-N-003 — Dev host resolver alignment

**Do:** Audit `resolve-host-tenant.ts` in marketing, portal, web — same `PHASE_43_HOST_TENANT_IDS` / `shop.` strip rules.

**Files:** `apps/marketing/src/tenant/`, `apps/portal/src/tenant/`, `apps/web/src/tenant/`

**Verify:** parity spec + existing host-bind specs green

---

### P6-0-N-004 — First customer seed

**Do:** Seed script: one Denali club subdomain + owner + ≥0 tours scaffold.

**Files:** `apps/api/scripts/` seed · document fixture tour id

**Verify:** seed id documented in runbook

---

### P6-0-N-005 — site_surfaces defaults

**Do:** Provision sets `{ marketing: true, portal: true, admin: true }` for first customer.

**Files:** tenant provision / `site_surfaces` JSON

**Verify:** `read-tenant-site-surfaces.spec.ts` or manual

---

### P6-0-N-006 — Env URL matrix

**Do:** Document `MARKETING_PUBLIC_BASE_URL`, `PORTAL_PUBLIC_BASE_URL`, admin origin for prod.

**Files:** `host-subdomain-map.md` § env

**Verify:** checklist in runbook

---

### P6-0-N-007 — Three-URL smoke script

**Do:** `scripts/smoke-p6-host-bind.mjs` — curl health on :3002/:3003/:3000 with same club host labels; print tenant ids.

**Verify:** script exits 0 in dev

---

### P6-0-N-008 — Prod subdomain note

**Do:** Document `{club}.admin.{root}` ingress → API tenant lookup (club_admin surface).

**Files:** `host-subdomain-map.md` § prod ingress

**Verify:** cross-ref `public-tenant-branding` if present

---

## EPIC exit

All three apps resolve **one tenant** for the smoke club · runbook complete.
