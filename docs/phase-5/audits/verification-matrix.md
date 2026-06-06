# Verification matrix

> **Truth ledger:** [`IMPLEMENTATION-TRUTH.md`](IMPLEMENTATION-TRUTH.md) — rows are targets until repo VERIFIED.  
> **SOURCE OF TRUTH:** REQ-P5-\* ↔ actions ↔ subphases  
> **Subphase map:** [`subphase-enforcement-map.md`](subphase-enforcement-map.md)  
> **Tests:** [`../appendices/test-matrix.md`](../appendices/test-matrix.md)

| Requirement ID | Requirement                             | Validation Method                                  | Evidence                                                  | Pass Condition                                                          |
| -------------- | --------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| REQ-P5-001     | phase_5_entry_requires all items        | Execute P5-0-A01 through P5-0-A07                  | phase_5_entry_verified.yaml                               | ALL validations PASS                                                    |
| REQ-P5-002     | phase-4:gate exit 0                     | pnpm run phase-4:gate                              | terminal exit code                                        | exit_code == 0                                                          |
| REQ-P5-003     | Forensic Phase 4 archived               | file exists check                                  | docs/audits/phase-4-zero-debt-forensic-audit.mdoc         | exists                                                                  |
| REQ-P5-004     | Postgres SoT via STORAGE_DRIVER factory | inspect create-tour-storage.ts + env               | repository_selection_audit                                | production→prisma; dev with DATABASE_URL requires STORAGE_DRIVER=prisma |
| REQ-P5-005     | RLS on tours                            | sql \d+ tours policies or integration test         | rls-isolation spec                                        | tenant A cannot read B                                                  |
| REQ-P5-006     | Event bus hook exists Phase 4           | read canonical-tour.service.ts                     | TourCreated publish call present                          | hook exists                                                             |
| REQ-P5-007     | canonical_data JSONB migration MAP 5.1  | migration up on Postgres                           | migration_history                                         | up exit 0                                                               |
| REQ-P5-008     | workspace_type on tenants               | schema query                                       | tenants columns                                           | workspace_type exists                                                   |
| REQ-P5-009     | validate via plugin MAP 5.2             | API test P5-2-A04                                  | `apps/api/test/canonical-validate-before-persist.spec.ts` | exit 0 · **VERIFIED**                                                   |
| REQ-P5-010     | assertCanonical before TX               | unit test ordering P5-2-A02                        | `apps/api/test/validate-before-persist-ordering.spec.ts`  | assert before `createTour`                                              |
| REQ-P5-011     | validateCanonical before TX             | unit test ordering P5-2-A03                        | same + `canonical-validation.ts`                          | validate before persist                                                 |
| REQ-P5-012     | sync projections MAP 5.3                | query test P5-3-A05                                | test log                                                  | exit 0                                                                  |
| REQ-P5-013     | same TX projections                     | rollback integration P5-3-A03                      | test log                                                  | atomic                                                                  |
| REQ-P5-014     | indexed list path                       | EXPLAIN P5-3-A04                                   | query plan                                                | index scan                                                              |
| REQ-P5-015     | outbox table exists                     | migration DDL P5-4-A01                             | \d outbox_events                                          | table exists                                                            |
| REQ-P5-016     | atomic tour+outbox                      | integration P5-4-A03                               | test log                                                  | single transaction                                                      |
| REQ-P5-017     | no publish before commit                | integration P5-4-A03                               | trace                                                     | ordering correct                                                        |
| REQ-P5-018     | TourCreated outbox MAP §6               | integration P5-4-A11                               | test log                                                  | handler receives event                                                  |
| REQ-P5-019     | SKIP LOCKED relay                       | integration two workers P5-4-A06                   | test log                                                  | no duplicate process                                                    |
| REQ-P5-020     | domain_event_id dedupe                  | integration P5-4-A07                               | test log                                                  | idempotent                                                              |
| REQ-P5-021     | tenant_id on outbox                     | schema NOT NULL                                    | DDL                                                       | column NOT NULL                                                         |
| REQ-P5-022     | cross-tenant dispatch forbidden         | unit test P5-4-A08                                 | test log                                                  | throws                                                                  |
| REQ-P5-023     | audit_events MAP 5.5                    | migration P5-5-A02 + write test                    | test log                                                  | exit 0                                                                  |
| REQ-P5-024     | phase-5.contract.spec.ts                | pnpm test path                                     | test results                                              | all pass                                                                |
| REQ-P5-025     | adversarial storage P0/P1               | P5-6-A02 specs                                     | test log                                                  | pass                                                                    |
| REQ-P5-026     | Big-O documented MAP R3                 | doc audit P5-6-A03                                 | DEL-P5-013 files                                          | each adapter documented                                                 |
| REQ-P5-027     | O(N) list blocked                       | P5-6-A04                                           | adversarial test                                          | fail on violation                                                       |
| REQ-P5-028     | forensic Purity >= 8                    | P5-6-A05 report                                    | reports/phase-5-forensic-audit-\*.md                      | score >= 8                                                              |
| REQ-P5-029     | no platform ES                          | schema review P5-X-A06                             | no event_store SoT                                        | absent                                                                  |
| REQ-P5-030     | no dual-write legacy                    | P5-X-A01 tests                                     | grep/depcruise                                            | zero writes                                                             |
| REQ-P5-031     | CASL scoped repo                        | existing tests P5-X-A03                            | tours scoped tests                                        | pass                                                                    |
| REQ-P5-032     | rebuild projections script              | P5-3-A06                                           | script test                                               | projections match canonical                                             |
| REQ-P5-033     | DEL-P5-001 schema doc                   | P5-1-A01                                           | phase-5-canonical-schema.md                               | exists with Appendix A 8 items                                          |
| REQ-P5-034     | migrateCanonical hook only              | P5-2-A05                                           | `apps/api/src/canonical/migrate-canonical-hook.ts`        | throws MIGRATE_CANONICAL_NOT_IMPLEMENTED — **VERIFIED**                 |
| REQ-P5-035     | OUTBOX_ENABLED fail-closed              | P5-4-A10                                           | integration                                               | write fails on outbox fail                                              |
| REQ-P5-036     | Reject Kafka required                   | infra review FORBIDDEN-004 P5-6 / phase-boundaries | compose files                                             | no mandatory broker                                                     |
| REQ-P5-037     | Phase 6 boundaries                      | PR review FORBIDDEN-008 through 011                | diff scope                                                | no Denali finance MinIO                                                 |
| REQ-P5-038     | Phase 7 boundaries                      | PR review FORBIDDEN-012 028 029                    | diff scope                                                | no silo urban replica policy                                            |
| REQ-P5-039     | closure gate                            | P5-6-A06                                           | BLOCKER until phase-5:gate defined                        | exit 0 when defined                                                     |
| REQ-P5-040     | Doc truth §18                           | P5-6-A07                                           | verification table                                        | 1:1 claim enforcement                                                   |

---

## Repo evidence index

| Subphase | Behavioral evidence (when VERIFIED)                                            |
| -------- | ------------------------------------------------------------------------------ |
| 5.2      | [`appendices/IMPLEMENTATION-MAP.md`](../appendices/IMPLEMENTATION-MAP.md) §5.2 |
| 5.3      | `apps/api/test/canonical-projection-sync.spec.ts` (target)                     |
| 5.4      | `apps/api/test/outbox-transactional.spec.ts` (target)                          |
| 5.5      | `apps/api/test/audit-events-tenant.spec.ts` (target)                           |

**Scaffold:** REQ-P5-024 — `phase-5.contract.spec.ts` does **not** satisfy 5.3–5.5 DoD.
