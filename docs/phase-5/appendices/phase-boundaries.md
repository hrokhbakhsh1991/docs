# Phase boundaries

> **SOURCE OF TRUTH:** research §5 hard boundary table · **Enforcement:** `phase-5-enforcement.md` FORBIDDEN-008–014

## Phase 5 MUST

- canonical_data JSONB contract + migrations
- Plugin-aware validate-before-persist (registry)
- Sync projection columns + indexed list queries
- outbox_events + transactional emit + relay
- Minimal audit_events
- TourCreated outbox integration test
- Idempotency keys API + outbox dedupe
- migrateCanonical design + hook only

## Phase 6 MUST NOT (before Phase 6)

| Item                                                              | Enforcement ID |
| ----------------------------------------------------------------- | -------------- |
| packages/workspaces/denali                                        | FORBIDDEN-009  |
| Finance hooks / ledger events                                     | FORBIDDEN-010  |
| MinIO photo upload                                                | FORBIDDEN-011  |
| Dynamic Denali bootstrap                                          | FORBIDDEN-009  |
| migrateCanonical legacy execution                                 | FORBIDDEN-014  |
| Denali-specific projection fields (extension only after 5.3 base) | RULE-026       |
| DENALI\_\* in apps/api core                                       | FORBIDDEN-008  |

## Phase 7 MUST NOT (before Phase 7)

| Item                                    | Enforcement ID |
| --------------------------------------- | -------------- |
| TenantConnectionRouter pool/silo        | FORBIDDEN-012  |
| Second workspace urban E2E              | FORBIDDEN-028  |
| Read replica / statement_timeout policy | FORBIDDEN-029  |
| CDC to warehouse (optional)             | deferred       |
| Rate limits + runbooks + OTel full      | deferred       |
| Marketing/Portal/Admin deploy split     | deferred       |

**Rules:** RULE-026–029, FORBIDDEN-008–014,028,029
