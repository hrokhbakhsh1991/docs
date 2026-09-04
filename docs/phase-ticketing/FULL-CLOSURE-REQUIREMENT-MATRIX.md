# Ticketing System — Full Closure Requirement Matrix

**Feature ID:** `ticketing-system-complete`
**Branch:** `feature/ticketing-system`
**Authority:** [`docs/standards/ticketing-system.mdoc`](../standards/ticketing-system.mdoc) §2 Full Production V1, §22 Phase A–L
**Session HEAD (bootstrap):** `e8e554bfe4cc7b9ebe45d28ffad4cab03eea4c6a`
**Date:** 2026-09-04

---

## Status legend

| Status | Meaning |
| ------ | ------- |
| COMPLETE | Implemented and verified with ledger evidence |
| IMPLEMENTED_BUT_UNVERIFIED | Code exists; full-matrix proof pending |
| PARTIAL | Some behavior shipped; mandatory remainder open |
| MISSING | Not implemented |
| EXPLICITLY_OUT_OF_SCOPE | Authoritative product doc §3 Extensions only |
| BLOCKED_BY_ARCHITECTURE | Design freeze / platform charter blocks without Architect unlock |
| BLOCKED_BY_PRODUCT_DECISION | Needs product scope decision |
| BLOCKED_BY_ENVIRONMENT | e.g. MinIO creds absent in Cloud |

---

## Phase summary

| Phase | Scope | Status | Evidence |
| ----- | ----- | ------ | -------- |
| **A** | ticketing-core + http-contracts | COMPLETE | 75/75 + 38/38 unit tests |
| **B/B1** | Prisma + RLS persistence | COMPLETE | `ticketing-persistence.postgres.spec.ts` |
| **C** | Lifecycle + messaging API | COMPLETE | `ticketing-http-postgres.spec.ts` |
| **D** | Categories, tags, queues, teams | COMPLETE | `ticketing-operational-d1-postgres.spec.ts` |
| **E** | Attachments + links | COMPLETE | `ticketing-attachments-e1-postgres.spec.ts`; MinIO skip = BLOCKED_BY_ENVIRONMENT |
| **F** | Member Portal BFF + UI | **PARTIAL→COMPLETE*** | Portal E2E 2/2; *viewer read-only slice completing this session |
| **G** | Operator inbox | **PARTIAL** | E2E 4/4; **bulk actions MISSING** (§2.1 #19) |
| **H** | Notifications in-app/email/SMS | **PARTIAL** | Ticket-scoped H1 shipped; **shared platform inbox MISSING** (user mandate) |
| **I** | SLA + escalation | COMPLETE | `ticket-sla.postgres.spec.ts`; worker needs `TICKETING_SLA_WORKER_ENABLED=1` in prod |
| **J** | Templates + automation | **PARTIAL** | API + postgres green; **composer picker UI MISSING** |
| **K/K1** | Search, reports, settings | COMPLETE | `ticket-k1.postgres.spec.ts`; operator E2E reports/settings |
| **L** | Security, E2E, a11y, release | **PARTIAL** | L1 cert only; retention jobs, axe, orphan cleanup **MISSING** |

---

## Full V1 capability matrix (§2.1)

| ID | Capability | Phase | Status | Missing work | Tests required |
| -- | ---------- | ----- | ------ | ------------ | -------------- |
| TKT-CAP-01 | Create/manage tickets | C/F | COMPLETE | — | postgres + portal E2E |
| TKT-CAP-02 | Multi-message conversation | C | COMPLETE | — | postgres |
| TKT-CAP-03 | Public reply + internal note | C/G | COMPLETE | — | postgres + operator E2E |
| TKT-CAP-04 | Status lifecycle | C | COMPLETE | — | core lifecycle.spec |
| TKT-CAP-05 | Priority triage | C/G | COMPLETE | — | postgres |
| TKT-CAP-06 | Workspace categories | D/K | COMPLETE | — | operational + settings |
| TKT-CAP-07 | Tags | D | COMPLETE | — | operational postgres |
| TKT-CAP-08 | Queues + filtered views | D/G | COMPLETE | — | operational + operator E2E |
| TKT-CAP-09 | Assignment user/team | D/G | COMPLETE | — | postgres |
| TKT-CAP-10 | Viewer tenant-wide read-only | F | **COMPLETE*** | *viewer portal UI + `toViewerTicketDetailHttp`* | postgres viewer test |
| TKT-CAP-11 | Secure attachments | E | COMPLETE | external malware engine = post-v1 plug-in | e1 postgres; MinIO optional |
| TKT-CAP-12 | Business entity links | E | COMPLETE | — | e1 postgres |
| TKT-CAP-13 | Audit trail | C | COMPLETE | — | postgres |
| TKT-CAP-14 | Persistent in-app notifications | H | **PARTIAL** | **Unified cross-domain Postgres inbox**; ticket bell ≠ platform bell | notification postgres + platform inbox spec |
| TKT-CAP-15 | Email/SMS abstraction | H | COMPLETE | noop/SK2 adapter | notification delivery spec |
| TKT-CAP-16 | SLA policies + escalation | I | COMPLETE | prod worker env flag | ticket-sla postgres |
| TKT-CAP-17 | Reply templates | J | **PARTIAL** | Operator composer template picker UI | templates postgres |
| TKT-CAP-18 | Search/filter/sort | K | COMPLETE | — | ticket-k1 postgres |
| TKT-CAP-19 | **Bulk operator actions** | G | **MISSING** | `POST /tickets/bulk`, operator multi-select toolbar | bulk postgres + E2E |
| TKT-CAP-20 | Reports dashboard | K | COMPLETE | — | k1 + operator E2E |
| TKT-CAP-21 | Workspace settings UI | K | COMPLETE | — | operator E2E |
| TKT-CAP-22 | RTL + responsive + **a11y** | L | **PARTIAL** | `@axe-core/playwright` on ticket routes (§14) | axe specs |
| TKT-CAP-23 | Idempotency + rowVersion | C | COMPLETE | — | postgres |
| TKT-CAP-24 | Observability + **retention jobs** | L | **PARTIAL** | Structured logs yes; **scheduled purge jobs MISSING** (§2.1 #24) | retention job spec |

---

## Post-v1 / accepted-risk reclassification (full closure)

| Item | L1 label | Full-closure status | Action |
| ---- | -------- | ------------------- | ------ |
| Bulk `POST /tickets/bulk` | post-v1 in §10.3 / L1 | **MISSING** — §2.1 #19 is V1 | Implement |
| Retention scheduled purge | post-v1 in §13 | **MISSING** — §2.1 #24 is V1 | Implement job + spec |
| Orphan attachment cleanup | TKT-GAP-007 accepted | **MISSING** — operational §13 implied | Implement job or EXPLICITLY_OUT_OF_SCOPE with doc |
| E2E memory storage | TKT-GAP-003 accepted | **COMPLETE** for dev; prod uses MinIO driver | Document; MinIO spec when env set |
| `@axe-core/playwright` | TKT-GAP-008 accepted | **MISSING** — §14 requires axe | Implement axe specs |
| TicketNotification module inbox | L1 accepted | **MISSING** for full closure — user requires **shared platform** | BLOCKED_BY_ARCHITECTURE until `IMPL-SK2.D+` + doc-first |
| DP-4 in-memory member inbox | existing | **MISSING** — must migrate to unified Postgres | Same platform dependency |
| External malware scan engine | post-v1 plug-in | EXPLICITLY_OUT_OF_SCOPE | MIME allowlist port sufficient for V1 |
| WhatsApp/AI/KB/etc. | §3 Extensions | EXPLICITLY_OUT_OF_SCOPE | §3 table |

---

## Notification platform dependency (mandatory for full closure)

**User mandate:** reusable in-app bell for ticketing, booking/tour, payment/debt, wallet — not `TicketNotification` as final contract.

| Requirement | Current | Target | Blocker |
| ----------- | ------- | ------ | ------- |
| Domain-agnostic inbox schema | `ticket_notifications` + DP-4 in-memory | `member_notifications` with `sourceModule`, `entityType`, `entityId`, `dedupeKey`, … | Doc-first + [`IMPL-SK2.D+`](../phase-saas-kernel/appendices/SK2_NOTIFICATION_OUTBOX.md) per [`notification-case-study.mdoc`](../dev/feature-delivery/notification-case-study.mdoc) |
| Unified read API | `/member/ticket-notifications/*` | `/member/notifications` (aggregate) | Platform migration |
| Portal bell | ticket-scoped only | cross-domain unread count | Portal BFF + UI |
| Booking/finance dispatchers | DP-4 in-memory | unified Postgres writer | Platform repo |
| Wallet (planned) | none | unified consumer | ADR only |

**Architecture classification:** platform capability
**Verdict:** BLOCKED_BY_ARCHITECTURE until Markdoc platform charter filed and Architect unlock recorded.

---

## CP1 implementation order (authorized non-blocked work)

| Task | Depends | Scope |
| ---- | ------- | ----- |
| TKT-FC-01 | — | Complete viewer portal slice (API projection + BFF + UI) |
| TKT-FC-02 | — | `POST /tickets/bulk` + operator UI multi-select |
| TKT-FC-03 | — | Retention purge scheduled job + spec |
| TKT-FC-04 | — | Orphan attachment cleanup job |
| TKT-FC-05 | — | `@axe-core/playwright` ticketing portal + web specs |
| TKT-FC-06 | — | Operator template composer picker |
| TKT-FC-07 | TKT-FC-00 doc | Unified `member_notifications` platform (doc-first, migration, dispatchers, bell) |
| TKT-FC-00 | — | `docs/standards/member-notification-inbox.mdoc` + Architect `IMPL-SK2.D+` |

---

## L1 already completed (evidence only)

See [`L1-CERTIFICATION-REPORT.md`](./L1-CERTIFICATION-REPORT.md) and [`GAP-REMEDIATION-REPORT.md`](./GAP-REMEDIATION-REPORT.md). L1 ≠ full §2.1 closure.

---

*CP0 inventory for FDA-001 `ticketing-system-complete`. Updated as slices land.*
