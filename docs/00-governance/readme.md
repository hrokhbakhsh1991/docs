Document-ID: MKT-DOC-README
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Standard Project Analysis Guide (Pre-Development Documentation)

This document defines a standard path for project analysis before any implementation starts.  
The objective is to ensure scope, requirements, decisions, flows, data model, and execution plan are fully aligned before coding.

---

## 1) Repository Purpose

This folder contains the **active documentation baseline** for the Marketplace project.

It is designed to:

- eliminate ambiguity before development,
- record product and architecture decisions in a traceable way,
- guide the team from discovery to implementation with clear deliverables.

---

## 2) Source Documents (Reference from Archive)

Historical and supporting documents are treated as non-local archive sources in this repository snapshot.
They are historical references only and are not canonical active documents.

Main reference files:

- marketplace_v1/project_overview (non-local archive reference)
- marketplace_v1/personas_and_usecases (non-local archive reference)
- marketplace_v1/requirements (non-local archive reference)
- marketplace_v1/ux_principles (non-local archive reference)
- marketplace_v1/screens_overview (non-local archive reference)
- marketplace_v1/mvp (non-local archive reference)
- marketplace_v1/data_model_EN (non-local archive reference)
- marketplace_v1/technical_spec (non-local archive reference)
- marketplace_v1/decisions_EN (non-local archive reference)
- marketplace_v1/roadmap (non-local archive reference)

Flow references:

- marketplace_v1/flows/registration_flow (non-local archive reference)
- marketplace_v1/flows/capacity_management_flow_EN (non-local archive reference)
- marketplace_v1/flows/waitlist_flow (non-local archive reference)
- marketplace_v1/flows/cost_and_payment_flow (non-local archive reference)
- marketplace_v1/flows/telegram_integration_flow (non-local archive reference)

---

## 3) Standard Analysis Sequence

Follow this sequence to avoid rework:

1. **Project framing**  
   Confirm problem statement, goals, and boundaries from `docs/10-product/product_overview.md`.

2. **Personas and use cases**  
   Validate priority actors and Must-have use cases from `docs/10-product/personas_usecases.md`.

3. **Requirements baseline**  
   Finalize functional/non-functional requirements and business rules from `docs/10-product/requirements.md`.

4. **UX guardrails**  
   Lock decision principles using `docs/10-product/ux_principles.md`.

5. **Screen coverage**  
   Cross-check screens with use cases using `docs/10-product/screens_overview.md`.

6. **MVP scope freeze**  
   Finalize In-Scope/Out-of-Scope in `docs/10-product/mvp_scope.md`.

7. **Data model freeze**  
   Confirm entities, relationships, states, and constraints in `docs/20-architecture/data_model.md`.

8. **Flow validation**  
   Validate all flow documents against requirements and data model consistency.

9. **Technical readiness**  
   Finalize architecture, APIs, access matrix, and NFRs in `docs/20-architecture/technical_spec.md`.

10. **Decision log finalization**  
    Record final trade-offs and rationale in `docs/20-architecture/decisions.md`.

11. **Execution planning**  
    Update delivery phases and milestones in `docs/10-product/roadmap.md`.

---

## 4) Required Outputs per Stage

- **Framing output:** clear problem statement and measurable goals.
- **Personas/use cases output:** prioritized use case list.
- **Requirements output:** approved FR/NFR set and business rules.
- **UX output:** enforceable UX principles for design and flows.
- **Screens output:** screen-to-use-case coverage map.
- **MVP output:** signed-off scope boundaries.
- **Data model output:** validated schema-level business representation.
- **Flows output:** reviewed end-to-end journey definitions.
- **Technical spec output:** implementation-ready technical baseline.
- **Decision log output:** complete record of critical decisions and implications.
- **Roadmap output:** phase-based execution and release plan.

---

## 5) Definition of Ready (DoR) Before Coding

Development starts only when all checks pass:

- [ ] Must-have use cases are finalized and unambiguous.
- [ ] Requirements are consistent with MVP and all core flows.
- [ ] Critical open questions in `docs/10-product/requirements.md` are resolved.
- [ ] Data model is finalized and aligned with flows.
- [ ] Core APIs and role permissions are specified in `docs/20-architecture/technical_spec.md`.
- [ ] Major architectural/product decisions are documented in `docs/20-architecture/decisions.md`.
- [ ] MVP roadmap has measurable milestones and delivery criteria.

---

## 6) Open Questions Management Standard

Each unresolved item should include:

- **ID** (e.g., `Q-01`)
- **Question**
- **Risk if unresolved**
- **Possible options**
- **Final decision**
- **Owner and decision date**
- **Impacted documents**

This can stay in `docs/10-product/requirements.md` or move to a dedicated log such as `docs/40-clarifications/clarifications_backlog.md`.

---

## 7) Documentation Quality Checklist

Before final approval of any document:

- **Consistency:** terms, statuses, and definitions are uniform across files.
- **Traceability:** each requirement maps to at least one use case and one flow.
- **Feasibility:** scope fits team capacity and timeline.
- **Testability:** requirements have clear acceptance criteria.
- **Non-contradiction:** no conflict between MVP, data model, and technical spec.

---

## 8) Suggested Next Execution Steps

1. Resolve high-impact open questions in `docs/10-product/requirements.md`.
2. Reconcile `docs/10-product/mvp_scope.md` with finalized requirements.
3. Re-validate `docs/20-architecture/data_model.md` against all flows.
4. Update `docs/20-architecture/technical_spec.md` based on steps 1–3.
5. Finalize `docs/20-architecture/decisions.md` with confirmed trade-offs.
6. Lock analysis baseline and update `docs/10-product/roadmap.md`.

---

## 9) Versioning and Maintenance Rules

- Any scope or rule change must update all impacted documents.
- Any strategic decision must be logged in `docs/20-architecture/decisions.md`.
- Add/update `Last Updated` in major docs on every meaningful revision.

---

## 10) Working Language

From this point onward, all active documentation should be written in English.

---

## 11) Active Leader-Centric Documentation Set

The following files define the current active baseline for the leader-centric model:

- `docs/20-architecture/canonical_framework.md`  
  Canonical terminology, statuses, roles, and consistency rules.

- `docs/00-governance/documentation_governance.md`  
  Main documentation governance standard (ISO 29148 + arc42 + RFC 2119/8174 + ADR + C4 baseline).

- `docs/00-governance/documentation_standard.md`  
  Standard document template and QA checklist for all new analyses.

- `docs/50-validation/migration_map.md`  
  Archive-to-active mapping (`Keep`, `Edit`, `Rewrite`, `Drop`) with migration criteria.

- `docs/50-validation/leader_app_delta_analysis.md`  
  Canonical delta decisions and dual-mode identity policy.

- `docs/10-product/product_overview.md`  
  Product framing and scope shift from marketplace to leader-centric operations.

- `docs/10-product/personas_usecases.md`  
  Updated personas and use-case priorities under the leader-centric model.

- `docs/10-product/requirements.md`  
  Normalized requirements for leader-centric, tenant-scoped, dual-mode operation.

- `docs/10-product/ux_principles.md`  
  UX principles for operational clarity and dual-mode consistency.

- `docs/10-product/screens_overview.md`  
  v2 information architecture and screen inventory.

- `docs/10-product/mvp_scope.md`  
  MVP in-scope/out-of-scope boundaries for the active model.

- `docs/20-architecture/data_model.md`  
  Canonical domain entities, status model, and tenant boundary constraints.

- `docs/20-architecture/technical_spec.md`  
  Technical baseline for architecture, auth, access control, and APIs.

- `docs/20-architecture/decisions.md`  
  Active decision log for product and architecture governance.

- `docs/10-product/roadmap.md`  
  v2 phased delivery roadmap.

- `docs/50-validation/flow_consistency_validation.md`  
  Validation report for registration/capacity/waitlist/payment/Telegram flows under the new model.

- `docs/50-validation/archive_traceability.md`  
  Archive-source to v2-target mapping with QA outcomes.

- `docs/20-architecture/flows/registration.md`
- `docs/20-architecture/flows/capacity_management.md`
- `docs/20-architecture/flows/waitlist.md`
- `docs/20-architecture/flows/cost_and_payment.md`
- `docs/20-architecture/flows/telegram_integration.md`

- `docs/30-analysis/step_01_business_mission.md`
- `docs/30-analysis/step_02_stakeholder_needs.md`
- `docs/30-analysis/step_03_system_requirements.md`
- `docs/20-architecture/contracts/participant_intake_schema.md`
- `docs/20-architecture/contracts/audit_event_schema.md`
- `docs/20-architecture/contracts/reconciliation_export_contract.md`
- `docs/30-analysis/step_05_pre_implementation.md`
- `docs/30-analysis/step_06_implementation_backlog.md`
- `docs/30-analysis/step_07_test_strategy.md`
- `docs/30-analysis/step_08_execution_plan.md`
- `docs/30-analysis/step_09_kpi_monitoring.md`
