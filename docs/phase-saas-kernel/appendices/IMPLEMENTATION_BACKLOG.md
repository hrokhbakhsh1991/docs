# Kernel — Demand-Driven Implementation Backlog

```yaml
doc_id: KERNEL_IMPLEMENTATION_BACKLOG
status: ACTIVE
as_of_tip: e40dd92a
date: 2026-07-21
design_track: COMPLETE (SK0–SK4)
```

**Rule:** Do not start a row without its **Trigger**. No hollow packages.

Stop gate: [AGENT_STOP_GATE.md](./AGENT_STOP_GATE.md) · Unlock menu: [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md)

Companion designs: [SK2](./SK2_NOTIFICATION_OUTBOX.md) · [SK3](./SK3_ENTITLEMENT_FLAGS.md) · [SK4](./SK4_AUDIT_FILE.md) · [TRAIN_CLOSURE_CHECKLIST.md](./TRAIN_CLOSURE_CHECKLIST.md)

---

## Phase status

| Track | Status |
| ----- | ------ |
| Stabilization WP0–WP5 + WP-GATE | **DONE** (pushed) |
| Kernel design SK0–SK4 | **DONE** |
| Kernel implementation | **PARTIAL** — SK2.C / SK3-FLAGS / SK3-BP7 / SK4-OBJ **DONE**; remaining IMPL rows waiting |

---

## Backlog (priority order)

| ID | Work | Trigger (must be true) | Forbidden without trigger |
| -- | ---- | ---------------------- | ------------------------- |
| **IMPL-SK2.C** | `NotificationDeliveryPort` + first real adapter wired from outbox/relay | **DONE** — `registration.approved` + `in_app` (2026-07-21) | Empty `packages/notification-*`; log-only with zero call sites |
| **IMPL-SK3-FLAGS** | Add field(s) to `TenantFeatureFlags` | **DONE** — `inAppRegistrationApprovedNotify` (2026-07-21) | Flag keys “for later” |
| **IMPL-SK3-BP7** | Plan tables / webhooks for portal entitlements | **DONE** — `YES — IMPL-SK3-BP7` (2026-07-21); [SK3_BP7_IMPLEMENTATION.md](./SK3_BP7_IMPLEMENTATION.md) | Fake plan SKUs |
| **IMPL-SK4-OBJ** | `TenantObjectStoragePort` wrapping MinIO | **DONE** — `YES — IMPL-SK4-OBJ` (2026-07-21); ACL `tenant-path-isolation` — [SK4_OBJ_IMPLEMENTATION.md](./SK4_OBJ_IMPLEMENTATION.md) | Second MinIO stack; touch tour aggregate storage |
| **IMPL-SK4-AUDIT** | `AuditAppendPort` + adapter | Compliance requirement to unify ≥2 audit streams | Dropping TX tour audit for async-only |
| **IMPL-INGRESS-RENAME** | Rename `apps/api/src/tenant-kernel/` → `tenant-ingress/` | Dedicated PR + import-boundary + SK1 sign-off | Drive-by rename |
| **IMPL-PORTAL-MODAL** | Portal login modal from WIP | Explicit product ticket on `wip/portal-psc-*` | Kernel PR scope |

---

## Already satisfied (do not re-do)

| Item | Evidence |
| ---- | -------- |
| Shared MinIO client for branding / avatar / receipt | **DONE + port** — `TenantObjectStoragePort` / `tenant-path-isolation` — [SK4_OBJ_IMPLEMENTATION.md](./SK4_OBJ_IMPLEMENTATION.md) |
| Outbox production relay posture | Stabilization P0 + `outbox/README.md` |
| Tenant-kernel package export freeze | `sk1-public-api-freeze.spec.ts` |
| Dual tenant-kernel surfaces documented | SK1 + API README |

---

## Suggested Architect prompts to unlock impl

1. `YES — IMPL-SK2.C` + name the first notify event / channel  
2. `YES — IMPL-SK3-FLAGS` + list new flag keys  
3. `YES — IMPL-SK4-OBJ` + state the shared ACL/lifecycle rule  

Until then, Kernel docs stay authoritative; agents must **not** invent consumers.

---

*Backlog only. Design track closed.*
