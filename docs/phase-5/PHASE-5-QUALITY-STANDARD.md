# Phase 5 — Engineering quality standard

```yaml
document_id: PHASE-5-QUALITY-STANDARD
version: "2026-06-04-v1"
status: BINDING
scope: "Phase 5 — Platform Events & Transactional Outbox (5.0–5.6)"
audience: [lead_architect, implementers, agents, reviewers]
supersedes_informal_notes: true
cross_refs:
  enforcement: phase-5-enforcement.md
  decisions: appendices/IMPLEMENTATION-DECISIONS.md
  ddl: ../../infra/sql/002_phase5_data_layer.sql
  tx_wrapper: apps/api/src/db/with-canonical-transaction.ts
```

> **Manifesto adoption:** This document codifies the Phase 5 Engineering Manifesto. All implementation work in Phase 5 MUST satisfy these five pillars. Violation is a **security or integrity failure**, not a style issue.

---

## Pillar 1 — Zero-Trust Event Bus

**Principle:** Every event published to the outbox (and every in-process dispatch after relay) MUST carry an explicit `tenantId`. There is no global tenant context; missing tenant identity is a **critical security failure**.

| Requirement                                                          | Enforcement                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `outbox_events.tenant_id` NOT NULL on every row                      | DDL [`infra/sql/002_phase5_data_layer.sql`](../../infra/sql/002_phase5_data_layer.sql); **RULE-011** |
| Payload includes `tenantId` (or equivalent) for domain events        | Schema + code review; **RULE-014** / `DOMAIN_EVENT_TENANT_REQUIRED`                                  |
| Relay / `publishDomainEvent` rejects empty or mismatched tenant      | Unit + integration tests on `packages/platform-events`                                               |
| No “ambient” tenant from process globals without ALS + explicit bind | **DEC-001** — orchestrator owns tenant on `writeTour`                                                |

**Forbidden:**

- Inserting an outbox row without `tenant_id`.
- Publishing from relay with inferred tenant from aggregate id alone (must match row `tenant_id`).
- Cross-tenant fan-out from a single write.

**Proof artifacts:** `platform-events` tenant guard tests; outbox insert tests asserting `tenant_id` column + payload parity.

---

## Pillar 2 — Atomicity guarantee

**Principle:** All writes to `outbox_events` MUST occur in the **same database transaction** as the business entity update (e.g. tour upsert). Partial success (tour committed, outbox missing — or the reverse) is unacceptable.

| Requirement                                                                            | Enforcement                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single `prisma.$transaction` spans tour + outbox (+ projections / audit when in scope) | **RULE-013**, **DEC-002**                                                                                                                                                    |
| Tenant RLS session set before queries in that transaction                              | `set_config('app.current_tenant_id', …, true)` inside TX — **DEC-002**                                                                                                       |
| Canonical write path uses tenant-scoped transaction API                                | **`withCanonicalTransaction(tenantId, (tx) => …)`** for 5.4+ writes ([`apps/api/src/db/with-canonical-transaction.ts`](../../apps/api/src/db/with-canonical-transaction.ts)) |
| Per-operation `withTenantRls` loops for multi-table canonical commits                  | **FORBIDDEN** after 5.4 for write path (**DEC-002**, **FORBIDDEN-005/006**)                                                                                                  |
| No `publishDomainEvent` / `publishTourCreatedEvent` before commit                      | **RULE-012**                                                                                                                                                                 |

**Implementation note:** `withCanonicalTransaction` and `withTenantRls` share the same RLS binding pattern; Phase 5 **write orchestration** standardizes on `withCanonicalTransaction` and `Prisma.TransactionClient` (`tx`) for all mutations inside one TX (**DEC-001**).

**Proof artifacts:** Integration test that aborts mid-transaction and asserts **neither** `tours` nor `outbox_events` rows persist (see Pillar 3).

---

## Pillar 3 — Documentation-as-Code

**Principle:** Code without updated subphase documentation is **not implemented**. Docs are part of the deliverable, not a follow-up chore.

| Requirement                                                                                                            | Enforcement                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Every new service, route, migration, or guard updates the matching `subphases/5.x-*.md`                                | Human + agent review checklist                                         |
| Behavioral claims in subphase docs match repo paths                                                                    | [`appendices/IMPLEMENTATION-MAP.md`](appendices/IMPLEMENTATION-MAP.md) |
| Ambiguities resolved in [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md) before code | **DEC-\*** wins over stale paragraphs                                  |
| IMPLEMENTATION-TRUTH row stays honest (no VERIFIED without proof)                                                      | [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)     |

**Minimum doc touch per change type:**

| Change           | Update                                                |
| ---------------- | ----------------------------------------------------- |
| Outbox / relay   | `subphases/5.4-transactional-outbox.md`               |
| Projections      | `subphases/5.3-projections.md`                        |
| Audit trail      | `subphases/5.5-audit-events.md`                       |
| Schema / DDL     | `phase-5-canonical-schema.md` + relevant subphase     |
| New HTTP surface | Subphase + `appendices/test-inventory.md` if new spec |

**Definition of Done (doc gate):** PR cannot be marked complete until the subphase file lists the new files, commands, and `prove_with` entries that match the diff.

---

## Pillar 4 — Test-first integrity

**Principle:** A feature is **not Done** until an integration spec proves that a **failing transaction rolls back both** the aggregate data **and** the outbox row.

| Requirement                                                                             | Enforcement                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Dedicated `*.integration.spec.ts` (or named integration block) per atomic write feature | **RULE-013**                                              |
| `STORAGE_DRIVER=prisma` + `DATABASE_URL` for outbox tests                               | **DEC-010** — in-memory driver cannot prove outbox        |
| Rollback scenario: forced error after outbox insert attempt inside TX                   | Assert 0 tour row + 0 outbox row for that idempotency key |
| Happy path: commit yields 1 tour + 1 outbox `pending` with matching `tenant_id`         | 5.4 prove_with in subphase                                |
| Relay idempotency covered separately                                                    | **RULE-015** — not a substitute for TX rollback test      |

**Naming convention:** `apps/api/test/<feature>-atomicity.integration.spec.ts` or extend `phase-5` contract integration suite as documented in `appendices/test-inventory.md`.

**Anti-pattern (FAIL):** `phase-5.contract.spec.ts` file-existence only cited as outbox proof ([`README.md`](README.md) FAIL table).

---

## Pillar 5 — RLS integrity

**Principle:** `outbox_events` MUST use the **same tenant isolation model** as tour data. No tenant may read or write another tenant’s outbox rows under session scope.

| Requirement                                                                                         | Enforcement                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ENABLE` + `FORCE ROW LEVEL SECURITY` on `outbox_events`                                            | [`infra/sql/002_phase5_data_layer.sql`](../../infra/sql/002_phase5_data_layer.sql) |
| Policy `outbox_tenant_isolation`: `USING` + `WITH CHECK` on `app.current_tenant_id`                 | Same expression family as `tours.tenant_isolation` in `001_tenant_rls.sql`         |
| Application queries use `tx.outbox_events` only inside `withCanonicalTransaction` / `withTenantRls` | Code review + integration                                                          |
| Admin bypass (`getPrismaAdmin`) forbidden for routine outbox reads in app path                      | Same policy as tour storage                                                        |
| Cross-tenant stress pattern                                                                         | Reuse concurrency isolation discipline from Phase 4 stress specs                   |

**Proof artifacts:**

- Integration: tenant A session cannot `SELECT` tenant B outbox row.
- Optional: extend `security-isolation-stress.spec.ts` pattern to `outbox_events` after 5.4.

---

## Agent / reviewer checklist (every Phase 5 task)

Before marking work complete, confirm **all five**:

1. [ ] **Zero-trust:** `tenantId` on outbox row and event payload; relay enforces match.
2. [ ] **Atomicity:** tour + outbox (± projections/audit) in one `withCanonicalTransaction` TX; no pre-commit bus publish.
3. [ ] **Docs:** corresponding `subphases/5.x-*.md` (+ IMPLEMENTATION-MAP / DEC if new pattern) updated in same change set.
4. [ ] **Tests:** integration spec proves rollback clears **both** tables; happy path committed under `STORAGE_DRIVER=prisma`.
5. [ ] **RLS:** outbox DDL/policy applied; cross-tenant read test green.

---

## Mapping to existing enforcement IDs

| Manifesto pillar      | Primary RULE-_ / FORBIDDEN-_                                |
| --------------------- | ----------------------------------------------------------- |
| Zero-Trust Event Bus  | RULE-011, RULE-014, FORBIDDEN-007                           |
| Atomicity             | RULE-012, RULE-013, FORBIDDEN-005, FORBIDDEN-006            |
| Documentation-as-Code | Phase doc-gate · `p5_doc_hardening` · subphase DoD          |
| Test-first integrity  | RULE-013, RULE-008 (projections), test-inventory            |
| RLS integrity         | RULE-011, `001` + `002` SQL policies, Phase 4 RLS carryover |

Full rule text: [`phase-5-enforcement.md`](phase-5-enforcement.md).

---

## Architect acknowledgment

By proceeding with Phase 5 implementation, agents and engineers **adopt this manifesto** as binding over informal shortcuts. When manifesto text and an older paragraph conflict, update the older doc or **`IMPLEMENTATION-DECISIONS.md`** — do not ship a third pattern.

**Related:** [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) (doc-system scores) · [`phase-5-guards.md`](phase-5-guards.md) (automated guards) · [`subphases/5.4-transactional-outbox.md`](subphases/5.4-transactional-outbox.md) (primary behavioral subphase for this manifesto).
