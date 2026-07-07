# P6-0 — Host & subdomain routing

```yaml
epic: P6-0
nanos: 9
priority: 1
blocks: P6-1
apps: [marketing, portal, web]
authority: ../p6-host-addressing-architecture.mdoc
```

## Goal

Three apps on **distinct host surfaces** resolve the **same club `tenantId`**. Support **dual addressing**: platform default URLs + per-club custom apex domains (`denali.club`). Without P6-0, catalog and register flows fail even when UI code is correct.

---

## Dual model (frozen)

| Layer | Marketing | Portal | Admin |
| ----- | --------- | ------ | ----- |
| **Platform default** | `{club}.{root}` | `{club}.portal.{root}` | `{club}.admin.{root}` |
| **Custom apex** | `denali.club` | `portal.denali.club` | `admin.denali.club` (target) |

**Workspace plugins** (Denali/Urban) do not share domains — only **tenants** do. See [p6-host-addressing-architecture.mdoc](../p6-host-addressing-architecture.mdoc).

**Ingress:** `resolvePublicIngressSubdomain` — platform parse → `tenant_domains` fallback.

---

## Dev smoke (`operator`)

| Surface | Canonical | Legacy alias |
| ------- | --------- | ------------ |
| Marketing | `operator.localhost:3002` | `shop.operator.localhost:3002` |
| Portal | `operator.portal.localhost:3003` | `operator.localhost:3003` |
| Admin | `operator.admin.localhost:3000` | `operator.localhost:3000` |

Runbook: [runbooks/host-subdomain-map.md](runbooks/host-subdomain-map.md)

---

## Nanos

### P6-0-N-001 — Host map runbook

**Do:** [runbooks/host-subdomain-map.md](runbooks/host-subdomain-map.md) — dual model, env, ingress, `/etc/hosts`.

**Verify:** linked from umbrella + architecture mdoc

---

### P6-0-N-002 — tenant-context parity spec

**Do:** `apps/api/test/p6-host-tenant-parity.spec.ts` — marketing, portal, admin hosts → same `tenantId` for `{club}`.

**Cases:** `club_apex`, `club_portal`, `club_admin` + legacy `shop.` marketing.

**Verify:** green

---

### P6-0-N-003 — Dev host resolver alignment

**Do:** Align `resolve-host-tenant.ts` in marketing, portal, web — same `PHASE_43_HOST_TENANT_IDS`; portal accepts `club_portal` **and** legacy apex; document migration to canonical `.portal.` dev hosts.

**Files:** `apps/marketing/src/tenant/`, `apps/portal/src/tenant/`, `apps/web/src/tenant/`

**Verify:** parity spec + host-bind specs green

---

### P6-0-N-004 — First customer seed

**Do:** Seed: one Denali club subdomain + owner + ≥0 tours scaffold.

**Verify:** fixture tour id in runbook

---

### P6-0-N-005 — site_surfaces defaults

**Do:** Provision `{ marketing: true, portal: true, admin: true }` for first customer.

**Verify:** `read-tenant-site-surfaces.spec.ts` or manual

---

### P6-0-N-006 — Env URL matrix

**Do:** `host-subdomain-map.md` § env — `MARKETING_PUBLIC_BASE_URL`, `PORTAL_PUBLIC_BASE_URL`, custom domain overrides.

**Verify:** checklist in runbook

---

### P6-0-N-007 — Three-URL smoke script

**Do:** `scripts/smoke-p6-host-bind.mjs` — curl `/public/tenant-context` on three canonical hosts; assert same `tenantId`.

**Verify:** script exits 0

---

### P6-0-N-008 — Prod ingress note

**Do:** Document `x-forwarded-host`, `club_admin` BFF login bind, middleware session rules (see phase-15 multilevel doc).

**Verify:** cross-ref `public-tenant-branding.mdoc`

---

### P6-0-N-009 — Custom domain addressing

**Do:** Document `tenant_domains` surfaces (`marketing`, `portal`) + CTA override via `PORTAL_PUBLIC_BASE_URL` for apex clubs like `denali.club`.

**Authority:** architecture mdoc §3–4 · `platform-domains-ssl.mdoc`

**Verify:** architecture mdoc §6 gaps H-P6-03 tracked

---

## EPIC exit

- Runbook complete
- Parity spec green
- Three surfaces resolve **one tenant** for smoke club
- Dual model documented (platform + custom apex)
