# P4-C — Club Surfaces Config · Nano-Task Spec (AI Lite v2)

```yaml
doc_id: P4-C-CLUB-SURFACES
version: 1.0-aligned
file_map: TEMP/p4/FILE-MAP.md
agent_entry: TEMP/p4/AGENT-START.md
nano_tasks: 12
parent_tasks: 6
start: P4-C-N-001
stop: P4-C-N-012
epic: P4-C
status: done
execute_after: P4-B-N-014
doc_first: docs/phase-17/platform-club-surfaces-config.mdoc
doc_status: complete
quality_target: 9.9+/10
```

> **Doc SoT:** [platform-club-surfaces-config.mdoc](../../docs/phase-17/platform-club-surfaces-config.mdoc)

## §Facts frozen (2026-06-21)

| #   | Fact                                | Evidence                                      |
| --- | ----------------------------------- | --------------------------------------------- |
| F1  | `site_surfaces` seeded on provision | `seed-tenant-site-surfaces-config.ts`         |
| F2  | Provision saga calls seed           | `provision-tenant-saga.ts`                    |
| F3  | Sites health check exists           | `check-tenant-sites-health.ts`                |
| F4  | Super Admin club detail exists      | `apps/web/src/platform/club-detail/`          |
| F5  | Gap G3 — no surfaces UI             | Sites tab lacks admin/marketing/portal badges |
| F6  | P2-A maintenance pattern            | `apps/marketing/src/platform/`                |

## Parent task map

| Parent                             | Nano              |
| ---------------------------------- | ----------------- |
| P4-C-T-001 API surfaces DTO        | N-001 N-002       |
| P4-C-T-002 BFF club detail         | N-003             |
| P4-C-T-003 Super Admin Sites tab   | N-004 N-005       |
| P4-C-T-004 Maintenance enforcement | N-006 N-007       |
| P4-C-T-005 Health + portal host    | N-008 N-009       |
| P4-C-T-006 EPIC gate               | N-010 N-011 N-012 |

## Config shape (frozen)

```json
{
  "admin": true,
  "marketing": true,
  "portal": true
}
```

| Key         | v1 rule                        |
| ----------- | ------------------------------ |
| `admin`     | Always `true` — cannot disable |
| `marketing` | Toggle read-only badge v1      |
| `portal`    | Toggle read-only badge v1      |

---

## NANO TASKS

### P4-C-N-001 [IMPLEMENT] P4-C-T-001 — GET tenant detail includes site_surfaces

**DO THIS**

1. Extend platform tenant detail DTO with `siteSurfaces: { admin, marketing, portal }`.
2. Read from `tenant_config` JSONB via existing platform repository.

**VERIFY** — TypeScript compile; no denali imports.

**STOP** if admin surface can be set false in API.

**NEXT:** N-002

---

### P4-C-N-002 [TEST] P4-C-T-001 — SF-05 API payload shape

**DO THIS**

Create `apps/api/test/platform-tenant-surfaces.spec.ts` (or extend existing platform tenant get spec).

**VERIFY**

| ID    | Assert                                                                  |
| ----- | ----------------------------------------------------------------------- |
| SF-05 | GET `/platform/tenants/:id` includes `siteSurfaces` with three booleans |
| SF-06 | Missing config defaults all `true`                                      |

**NEXT:** N-003

---

### P4-C-N-003 [IMPLEMENT] P4-C-T-002 — BFF club detail surfaces field

**DO THIS**

1. Platform club detail BFF forwards `siteSurfaces` to web client.
2. Wire types in `apps/web/src/platform/club-detail/`.

**VERIFY** — club detail page receives surfaces without extra round-trip.

**NEXT:** N-004

---

### P4-C-N-004 [IMPLEMENT] P4-C-T-003 — Sites tab UI badges SF-01…SF-04

**DO THIS**

Extend Sites panel in platform club detail:

```text
Admin     ● enabled   {adminUrl}
Marketing ● enabled   {marketingUrl}
Portal    ● enabled   {portalUrl}
[Check health]
```

Add `data-platform-surface="admin|marketing|portal"` markers for tests.

**VERIFY** — visual review; no PATCH toggle v1.

**STOP** if editing `packages/workspaces/denali`.

**NEXT:** N-005

---

### P4-C-N-005 [TEST] P4-C-T-003 — platform-club-surfaces-tab.spec.ts

**DO THIS**

Create `apps/web/test/platform-club-surfaces-tab.spec.ts`.

**VERIFY**

| ID    | Assert                                       |
| ----- | -------------------------------------------- |
| SF-01 | Sites tab renders `data-platform-club-sites` |
| SF-02 | Three surface rows present                   |
| SF-03 | Each row shows enabled badge                 |
| SF-04 | URLs match provision response shape          |

```bash
pnpm --filter @apps/web exec node --import tsx --test test/platform-club-surfaces-tab.spec.ts
```

**NEXT:** N-006

---

### P4-C-N-006 [IMPLEMENT] P4-C-T-004 — marketing middleware reads surfaces

**DO THIS**

1. Marketing middleware loads tenant `site_surfaces` (via existing tenant resolve or BFF).
2. When `marketing: false` → route to maintenance page (P2-A pattern).

**VERIFY** — local dev with seeded false shows maintenance stub.

**NEXT:** N-007

---

### P4-C-N-007 [TEST] P4-C-T-004 — SF-07 maintenance when marketing false

**DO THIS**

Create `apps/marketing/test/tenant-site-surfaces-maintenance.spec.ts`.

**VERIFY**

| ID    | Assert                                               |
| ----- | ---------------------------------------------------- |
| SF-07 | `marketing: false` → maintenance response / redirect |

**NEXT:** N-008

---

### P4-C-N-008 [IMPLEMENT] P4-C-T-005 — sites/check portal host

**DO THIS**

Extend `check-tenant-sites-health.ts` to probe portal URL (not just admin + marketing).

**VERIFY** — platform `POST .../sites/check` returns portal status field.

**NEXT:** N-009

---

### P4-C-N-009 [TEST] P4-C-T-005 — health includes portal

**DO THIS**

Unit test sites check response includes portal reachability.

**VERIFY** — SF-08 (optional): portal host in health JSON.

**NEXT:** N-010

---

### P4-C-N-010 [DOC] P4-C-T-006 — platform-control-center cross-ref

**DO THIS**

1. Link `platform-control-center-ui.mdoc` Sites section ↔ P4-C mdoc.
2. Document read-only v1 vs future PATCH toggle.

**VERIFY** — mdoc `quality: 9.9`.

**NEXT:** N-011

---

### P4-C-N-011 [VERIFY] P4-C-T-006 — import boundary

**DO THIS**

```bash
pnpm run guard:import-boundary
```

**VERIFY** — exit 0.

**NEXT:** N-012

---

### P4-C-N-012 [TEST] P4-C-T-006 — EPIC gate

**DO THIS**

All SF specs green · denali diff empty.

**VERIFY**

```bash
pnpm run guard:import-boundary
pnpm --filter @apps/web exec node --import tsx --test test/platform-club-surfaces-tab.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/platform-tenant-surfaces.spec.ts
git diff --quiet packages/workspaces/denali
```

**NEXT:** P4-D-N-001
