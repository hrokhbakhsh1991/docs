# MAP bridge — Phase 5

> **SOURCE OF TRUTH:** [`../../MIGRATION-MAP.md`](../../MIGRATION-MAP.md)

| MAP section           | Phase 5 binding                  | Module                      |
| --------------------- | -------------------------------- | --------------------------- |
| §5 Infrastructure     | Postgres migration real DB       | 5.1, ci                     |
| §6 Event bus & Outbox | outbox_events + TourCreated exit | 5.4                         |
| §7.1 Tenant pool RLS  | continues Phase 4                | 5.0, RULE-019               |
| §8.3 migrateCanonical | hook only Phase 5                | 5.2, DEL-P5-008             |
| §10 Observability     | audit_events minimal             | 5.5                         |
| §11 Phase 5.1–5.5     | subphases 5.1–5.5                | subphases/                  |
| §12 Phase 5 checklist | 5.6                              | ci.md                       |
| §17 Simplicity        | forensic waiver                  | audits/forensic-template.md |

## MAP Phase 5 exit table

| #   | کار                                        | Exit       | Subphase |
| --- | ------------------------------------------ | ---------- | -------- |
| 5.1 | schema workspace_type canonical_data JSONB | migration  | 5.1      |
| 5.2 | validate via plugin before persist         | API test   | 5.2      |
| 5.3 | projected columns list/filter              | query test | 5.3      |
| 5.4 | transactional outbox + one domain event    | §6         | 5.4      |
| 5.5 | audit_events minimal                       | §10        | 5.5      |

**§6 exit:** one event TourCreated from API to handler with outbox test — P5-4-A11
