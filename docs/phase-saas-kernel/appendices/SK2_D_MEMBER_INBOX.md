# SK2.D+ — Unified Member Notification Inbox

```yaml
doc_id: SK2_D_MEMBER_INBOX
tranche: SK2.D+
status: IMPLEMENTATION_AUTHORIZED
charter: docs/standards/member-notification-inbox.mdoc
```

---

## Unlock record

| Field | Value |
| ----- | ----- |
| **Unlock** | `IMPL-SK2.D+` |
| **Authorized by** | Product owner / Architect — explicit user authorization in FDA session |
| **Date** | 2026-09-04 |
| **Feature** | `ticketing-system-complete` (full closure) |
| **Branch** | `feature/ticketing-system` |

**Authorization text (paraphrased):** User explicitly authorized the shared-notification path for ticketing full closure. Ticket-only `ticket_notifications` is **forbidden** as the final shared design. Implement unified Postgres inbox for ticketing, booking/tour, payment/debt, and wallet.

**Prior state:** SK2 design freeze listed unified inbox as blocked pending Architect unlock. **No prior `IMPL-SK2.D+` row existed.**

---

## Reconciliation with SK2 design freeze

| SK2 rule | SK2.D+ implementation |
| -------- | ---------------------- |
| Outbox = transport SoT | Unchanged — dispatchers remain outbox consumers |
| `NotificationDeliveryPort` for email/SMS | Unchanged — `member_notification_deliveries` queue |
| No hollow `packages/notification-kernel` | Host composition in `apps/api/src/notifications` |
| In-app channel | **New:** `member_notifications` Postgres table (domain-agnostic) |

---

## Definition of Done — SK2.D+

| Criterion | Evidence |
| --------- | -------- |
| Charter filed | `docs/standards/member-notification-inbox.mdoc` |
| Schema + RLS migration | `member_notifications`, `member_notification_deliveries` |
| Writers migrated | ticketing + booking/finance + wallet stub |
| Aggregate API | `/member/notifications/*` |
| Portal bell cross-domain | unread count from aggregate API |
| Postgres specs green | `member-notifications.postgres.spec.ts` |

---

*SK2.D+ unlock recorded 2026-09-04 — not retroactive to prior sessions.*
