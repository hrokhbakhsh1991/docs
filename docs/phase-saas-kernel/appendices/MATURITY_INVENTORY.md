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
| Entitlement | `workspace-sdk` portal entitlements; `me.entitlements.*`; MPS-ENT-001 | **Low–Medium** | **SK3 design** — plan tables still BP-7 |
| Notification | Outbox + relay (Stabilization P0 hardened); no unified Email/SMS/in-app platform | **Medium transport / Low product** | **SK2 design filed** — providers only with first adapter PR |
| File Service | Tour/object storage + finance receipt proof ports | **Medium (domain-scoped)** | Generalize only with second consumer (SK4) |
| Feature Flags | `resolve-tenant-feature-flags` + freeze helpers | **Low–Medium** | **SK3 design** — expand fields only with real need |
| Audit | Scattered (outbox replay, tour write guards, recon audit) | **Low** | Universal contract after SK1 (SK4) |
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

## Residuals (tracked, not blocking Kernel SK0–SK2 design)

| Item | Notes |
| ---- | ----- |
| Postgres capacity / concurrency / guest-dupe | **PASS** on close train |
| Portal modal on `wip/portal-psc-20260718` | Separate product ticket — not Kernel |
| Tours without `capacityMax` fixture path | Hostile residual P1 |
| SK2.C / SK3 impl / SK4 | Demand-driven per charter |
| Rename `apps/api/src/tenant-kernel/` | Deferred (SK1) |

---

*SK0 inventory current. Kernel phase remains OPEN for SK2.C+ / SK3 / SK4.*
