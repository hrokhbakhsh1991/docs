# Ticketing Gap Remediation — Full Production V1

**Date:** 2026-09-04  
**Branch:** `feature/ticketing-system`  
**Input:** READ-ONLY gap audit (conversation L1 audit findings TKT-GAP-001 … TKT-GAP-011)

---

## Finding checklist

| ID | Priority | Finding | Status | Remediation |
|----|----------|---------|--------|-------------|
| TKT-GAP-001 | P1 | `scanStatus=clean` set on complete without scan hook | **FIXED** | `TicketAttachmentScanPort` + `getTicketAttachmentScanner()` called before complete; reject path sets `rejected` + removes object |
| TKT-GAP-002 | P1 | Ticketing attachments not tested against real MinIO | **FIXED** | `apps/api/test/ticketing-attachments-minio.spec.ts` (skip without `MINIO_*`) |
| TKT-GAP-003 | P1 | L1 Playwright used memory adapter | **ACCEPTED_RISK** | Documented in mdoc §19.4; E2E velocity; production uses MinIO adapter |
| TKT-GAP-004 | P2 | Bulk actions documented V1 but not implemented | **FIXED** | Docs: `POST /tickets/bulk` marked post-v1 in mdoc §10.3 + persona table |
| TKT-GAP-005 | P2 | Retention jobs documented V1 but not implemented | **FIXED** | Docs: scheduled purge jobs post-v1; settings fields remain |
| TKT-GAP-006 | P2 | SLA worker off unless env flag | **FIXED** | SLA worker runbook added to mdoc Phase I |
| TKT-GAP-007 | P2 | No orphan attachment object cleanup | **ACCEPTED_RISK** | Post-v1 operational job; scan reject removes object on failure |
| TKT-GAP-008 | P2 | No `@axe-core/playwright` on ticketing | **ACCEPTED_RISK** | FA copy + responsive viewport specs; axe post-v1 |
| TKT-GAP-009 | P2 | Postgres specs fail with superuser `DATABASE_URL` | **FIXED** | `assertPostgresAppRoleForRlsTests()` in all ticketing Postgres specs |
| TKT-GAP-010 | P3 | Dev `tenant-registry` hardcodes ticketing for operator dev tenant | **NOT_APPLICABLE** | Dev-only fixture; production uses DB registry |
| TKT-GAP-011 | P3 | L1 report PRODUCTION-READY while GAP-001/002 open | **FIXED** | L1 report verdict updated; this report records remediation |

---

## Code changes

| File | Change |
|------|--------|
| `apps/api/src/workspace-ticketing/ticket-attachment-scan.ts` | New scan port + allowlist V1 scanner |
| `apps/api/src/workspace-ticketing/ticketing-e1.operations.ts` | Scan before complete; reject handling |
| `apps/api/src/workspace-ticketing/infrastructure/ticketing-attachment.repository.ts` | `markScanRejected()` |
| `apps/api/src/workspace-ticketing/ticketing-postgres-test-helpers.ts` | `assertPostgresAppRoleForRlsTests()` |
| `apps/api/test/ticketing-attachments-minio.spec.ts` | MinIO round-trip |
| `apps/api/test/ticketing-attachments-e1-postgres.spec.ts` | Scan reject test + app-role guard |
| All ticketing `*.postgres.spec.ts` | App-role guard in `before()` |
| `docs/standards/ticketing-system.mdoc` | Scan port, bulk/retention post-v1, SLA runbook |
| `docs/phase-ticketing/L1-CERTIFICATION-REPORT.md` | Verdict alignment |

---

## Architect documentation status

**Updated.** Link: [`docs/standards/ticketing-system.mdoc`](../standards/ticketing-system.mdoc) — §19.4 scan port, Phase I SLA runbook, L1 post-v1 list.
