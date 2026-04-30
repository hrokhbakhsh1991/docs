Document-ID: MKT-DOC-ARCHIVE-TO-V2-TRACEABILITY
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Archive to v2 Traceability Matrix

## Purpose
Track how archive documents map to active v2 outputs.

| Archive Source | v2 Target | Migration Action | Notes |
|---|---|---|---|
| `marketplace_v1/project_overview` (non-local archive ref) | `docs/10-product/product_overview.md` | Rewrite | Leader-centric framing replaces global discovery framing |
| `marketplace_v1/personas_and_usecases` (non-local archive ref) | `docs/10-product/personas_usecases.md` | Edit/Rewrite | Personas preserved, use-case framing updated |
| `marketplace_v1/requirements` (non-local archive ref) | `docs/10-product/requirements.md` | Edit/Rewrite | Operational requirements preserved; marketplace assumptions removed |
| `marketplace_v1/ux_principles` (non-local archive ref) | `docs/10-product/ux_principles.md` | Edit | Principles retained and normalized |
| `marketplace_v1/screens_overview` (non-local archive ref) | `docs/10-product/screens_overview.md` | Rewrite | Leader workspace IA replaces global catalog IA |
| `marketplace_v1/mvp` (non-local archive ref) | `docs/10-product/mvp_scope.md` | Edit | MVP philosophy retained with v2 boundaries |
| `marketplace_v1/data_model_EN` (non-local archive ref) | `docs/20-architecture/data_model.md` | Edit | Model retained + explicit tenant boundary rules |
| `marketplace_v1/technical_spec` (non-local archive ref) | `docs/20-architecture/technical_spec.md` | Edit/Rewrite | Dual-mode and tenant isolation clarified |
| `marketplace_v1/decisions_EN` (non-local archive ref) | `docs/20-architecture/decisions.md` | Edit/Extend | Existing logic preserved, v2 decisions added |
| `marketplace_v1/roadmap` (non-local archive ref) | `docs/10-product/roadmap.md` | Edit | Phasing aligned to migration and leader-centric rollout |
| `marketplace_v1/flows/registration_flow` (non-local archive ref) | `docs/20-architecture/flows/registration.md` | Edit/Rewrite | Entry context changed to leader-owned channels |
| `marketplace_v1/flows/capacity_management_flow_EN` (non-local archive ref) | `docs/20-architecture/flows/capacity_management.md` | Edit | Capacity rules preserved |
| `marketplace_v1/flows/waitlist_flow` (non-local archive ref) | `docs/20-architecture/flows/waitlist.md` | Edit | FIFO and conversion logic preserved |
| `marketplace_v1/flows/cost_and_payment_flow` (non-local archive ref) | `docs/20-architecture/flows/cost_and_payment.md` | Edit | MVP payment tracking semantics preserved |
| `marketplace_v1/flows/telegram_integration_flow` (non-local archive ref) | `docs/20-architecture/flows/telegram_integration.md` | Edit/Extend | Dual-mode identity policy added |

---

## QA Checklist Outcome

- English-only active v2 docs: `Pass`
- Canonical terms and statuses aligned with `docs/20-architecture/canonical_framework.md`: `Pass`
- No dependency on global cross-leader discovery in active v2 set: `Pass`
- Flow/requirements/data-model consistency: `Pass`
