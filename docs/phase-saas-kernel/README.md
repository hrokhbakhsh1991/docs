# Phase — SaaS Shared Kernel

```yaml
phase_id: saas-shared-kernel
status: OPEN
opened_from: Stabilization WP-GATE ACCEPTED
opened_at: 2026-07-20
stabilization_tip: 2eb69516
branch: booking/capacity-concurrency-cert
execution_entry: docs/phase-saas-kernel/CHARTER.md
```

## Role

Reusable SaaS operating-system kernels consumed by every customer and workspace type via **explicit contracts** — without embedding Denali (or any one product) into the kernel.

## Documents

| Doc | Role |
| --- | ---- |
| [CHARTER.md](./CHARTER.md) | Executable phase charter (SoT) |
| [appendices/MATURITY_INVENTORY.md](./appendices/MATURITY_INVENTORY.md) | SK0 maturity matrix (exists vs gap) |
| [appendices/SK1_TENANT_AUTHZ_CONTRACTS.md](./appendices/SK1_TENANT_AUTHZ_CONTRACTS.md) | SK1 Tenant + Authz design (dual-surface freeze) |
| Stabilization WP-GATE | [`../phase-20/p7/appendices/STABILIZATION_WP_GATE.md`](../phase-20/p7/appendices/STABILIZATION_WP_GATE.md) |
| Phase 4 Tenant Kernel (do not reinvent) | [`../phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md) · [`../phase-4/phase-4-ai-exec.md`](../phase-4/phase-4-ai-exec.md) |

## First tranche order

1. **SK0** — Inventory freeze (filed)  
2. **SK1** — Tenant + Authz contract hardening (**CLOSED**)  
3. **SK2** — Notification on outbox  
4. **SK3** — Entitlement + Feature Flags contracts  
5. **SK4** — Audit + File (demand-driven)

## Non-goals (until Architect expands)

- Entitlement/subscription product UI as primary work  
- Blind merge of `origin/DEV`  
- Full `phase-*:gate` without YES  
- Parallel second Tenant Kernel beside Phase 4  

TEMP design draft (superseded as SoT by this pack): `TEMP/SAAS_SHARED_KERNEL_DESIGN_DRAFT.md`
