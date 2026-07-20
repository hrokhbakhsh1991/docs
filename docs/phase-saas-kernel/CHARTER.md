# SaaS Shared Kernel — Charter

```yaml
doc_id: SAAS_SHARED_KERNEL_CHARTER
status: OPEN
location: docs/phase-saas-kernel/
opened: 2026-07-20
wp_gate: ACCEPTED
stabilization_tip_at_open: 2eb69516
canonical_branch: booking/capacity-concurrency-cert
source_draft: TEMP/SAAS_SHARED_KERNEL_DESIGN_DRAFT.md
```

## 1. Goal

Turn the stabilized monorepo into a **reusable SaaS operating system**: kernels every customer/workspace consumes via explicit contracts, without Denali (or any one product) embedded in the kernel.

## 2. Entry condition

Stabilization WP-GATE **ACCEPTED** (evidence: [`../phase-20/p7/appendices/STABILIZATION_WP_GATE.md`](../phase-20/p7/appendices/STABILIZATION_WP_GATE.md)).

Engineering Stabilization (WP0–WP5) is closed for gate purposes. Residual P1s remain tracked in hostile remediation and do not block Kernel SK0–SK1 start.

## 3. Hard rules

1. Kernel must not know business details (tour itineraries, Denali registration transport, club ledger labels).
2. No abstractions before real requirements — no empty kernel packages.
3. Do **not** duplicate Phase 4 Tenant Kernel (`docs/phase-4-*`); close gaps there or consume `packages/tenant-kernel`.
4. Prefer extract/stabilize existing host code over greenfield rewrites when a capability already works.
5. PostgreSQL + RLS remains production SoT; memory is not a production strategy.
6. Doc-first for `platform-core`, `workspace-sdk`, `apps/api`.
7. No full gates without Architect YES; prefer fast-track / targeted verify.
8. Workspaces declare needs via manifests/ports; they do not fork kernel behavior.

## 4. Work packages

| WP | Name | Intent | Code now? |
| -- | ---- | ------ | --------- |
| **SK0** | Inventory freeze | Maturity matrix with file evidence | Docs only |
| **SK1** | Tenant + Authz contracts | Consumable contracts; no second member-session SoT (PCMS) | Only after SK0 accepted |
| **SK2** | Notification on outbox | Provider port on existing outbox/relay | After SK1 or parallel if scoped |
| **SK3** | Entitlement + Flags | Unify module access contracts | After SK1 |
| **SK4** | Audit + File | Only when a second consumer needs them | Demand-driven |

Detail and maturity: [appendices/MATURITY_INVENTORY.md](./appendices/MATURITY_INVENTORY.md).

## 5. Customer onboarding shape (vision)

```text
Create Tenant → Select Workspace Type → Enable Modules →
Apply Entitlements → Provision Shared Services → Activate Workspace
```

## 6. Definition of success (phase)

- Second customer onboarded without forking core  
- New workspace type without rewriting kernel  
- Modules per tenant via entitlement  
- RLS + app boundaries hold  
- Notifications outbox-backed when SK2 lands  
- Files tenant-isolated when File service exists (SK4)

## 7. Immediate next action

SK0 filed. SK1 **design** filed: [appendices/SK1_TENANT_AUTHZ_CONTRACTS.md](./appendices/SK1_TENANT_AUTHZ_CONTRACTS.md).

Next: accept SK1 design, then micro-PRs in §7 of that doc (API tenant-kernel README → package export freeze test). **No JWT extraction into package in SK1.**

## 8. Explicit non-goals now

- Portal login modal reclaim (`wip/portal-psc-*`) as Kernel work  
- Merge `origin/DEV` into tip  
- Premature subscription/commerce UI  
- Replacing Phase 4 execution entry with this charter for tenant RLS work  

---

*Opened from Stabilization. Update status when SK0–SK4 close.*
