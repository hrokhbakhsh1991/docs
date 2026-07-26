# SK0 — Shared Kernel Maturity Inventory

```yaml
doc_id: SAAS_KERNEL_MATURITY_INVENTORY
tranche: SK0
status: FILED
as_of_tip: 2eb69516
date: 2026-07-20
```

**Purpose:** Freeze “exists vs gap” so Kernel work does not reinvent Phase 4 or bury host capabilities under empty packages.

## Maturity table

| Target | Current reality | Maturity | Posture |
| ------ | --------------- | -------- | ------- |
| Tenant Kernel | `packages/tenant-kernel` (host/RLS/route); Phase 4 docs + Postgres RLS; provision/smoke | **High** | Reuse Phase 4; no parallel package |
| Tenant request ingress | `apps/api/src/tenant-kernel/` (JWT/dev-bearer/headers) — **not** the npm package | **High (host)** | Keep split; rename deferred (see SK1) |
| Authorization | `apps/api` identity + CASL patterns; operator session; PCMS (`docs/standards/member-session-portal-authority.mdoc`) | **Medium–High** | Extract contracts where duplication hurts; portal remains member-session SoT |
| Entitlement | `workspace-sdk` portal entitlements; `me.entitlements.*`; MPS-ENT-001; **BP-7 plan tables** | **Medium** | SK3.C BP-7 landed — [SK3_BP7_IMPLEMENTATION.md](./SK3_BP7_IMPLEMENTATION.md) |
| Notification | Outbox + relay (Stabilization P0 hardened); no unified Email/SMS/in-app platform | **Medium transport / Low product** | **SK2 design filed** — providers only with first adapter PR |
| File Service | Tour aggregate store ≠ blob media; branding/avatar/receipt via `TenantObjectStoragePort` | **Medium** | SK4.D **DONE** — ACL `tenant-path-isolation` — [SK4_OBJ_IMPLEMENTATION.md](./SK4_OBJ_IMPLEMENTATION.md) |
| Feature Flags | `resolve-tenant-feature-flags` + freeze helpers | **Low–Medium** | **SK3 design** — expand fields only with real need |
| Audit | Tour/settings/platform/outbox/recon streams | **Low–Medium** | **SK4 design** — unify only with second consumer |
| Shared Infrastructure | `platform-events`; outbox; metrics; ad hoc jobs | **Medium** | Ownership map; avoid mega-bus rewrite |

## Key paths (evidence anchors)

| Area | Anchors |
| ---- | ------- |
| Tenant | `packages/tenant-kernel/src/**`, `docs/phase-4/phase-4-ai-exec.md` |
| Authz / session | `apps/api/src/identity/**`, `packages/session-client/**`, PCMS standard |
| Outbox | `apps/api/src/outbox/**`, Stabilization P0 relay posture |
| Flags | `apps/api/src/tenant/resolve-tenant-feature-flags.ts` |
| Entitlements | `packages/workspace-sdk/src/portal/evaluate-member-portal-entitlements.ts` |
| Events | `packages/platform-events/**` |

## SK0 Done

- [x] Matrix filed under `docs/phase-saas-kernel/`  
- [x] SK1 kickoff design opened: [SK1_TENANT_AUTHZ_CONTRACTS.md](./SK1_TENANT_AUTHZ_CONTRACTS.md)  
- [x] Architect continue / review via execution train (2026-07-20)  
- [x] SK2 design opened: [SK2_NOTIFICATION_OUTBOX.md](./SK2_NOTIFICATION_OUTBOX.md)  
- [x] SK3 design opened: [SK3_ENTITLEMENT_FLAGS.md](./SK3_ENTITLEMENT_FLAGS.md)  
- [x] SK4 design opened: [SK4_AUDIT_FILE.md](./SK4_AUDIT_FILE.md)  

## Residuals (tracked, not blocking Kernel SK0–SK2 design)

| Item | Notes |
| ---- | ----- |
| Postgres capacity / concurrency / guest-dupe | **PASS** on close train |
| Capacity stress on tip | **PASS** 3/3 (2026-07-21) |
| Missing tour `capacityMax` under prodlike | **CLOSED (C8)** — fail-closed; test/dev fixture intake only |
| Portal modal on `wip/portal-psc-20260718` | **PARKED (C9)** — `YES — IMPL-PORTAL-MODAL` |
| Package-boundary allowlist misread | **PARKED (C10)** — AST isolation |
| DEV pointer / stash reclaim | B6 DECIDED / B7 quarantined — need Architect YES phrases |
| SK2.C / SK3 impl / SK4 ports | Demand-driven — [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md) |
| Rename `apps/api/src/tenant-kernel/` | Deferred — `YES — IMPL-INGRESS-RENAME` |

---

*SK0–SK4 design inventory current. Kernel implementation waits on Architect unlock only.*
