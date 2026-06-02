import { BOOKING_CREATED_EVENT_TYPE } from "../events/booking-created.event";

/**
 * Outbox `event_type` values that represent **financial** domain facts (money movement, price pipeline,
 * payment lifecycle). Used to attach mandatory `tenant_audit_events` rows on enqueue.
 */
export function isFinancialOutboxEventType(eventType: string): boolean {
  const t = eventType.trim();
  if (t === "") return false;
  if (t === BOOKING_CREATED_EVENT_TYPE) return true;
  if (t === "registration.payment_updated") return true;
  if (t.startsWith("finance.ledger.")) return true;
  if (t.startsWith("booking.finalization.")) return true;
  if (t.startsWith("payment.")) return true;
  return false;
}
