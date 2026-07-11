/** AP15 P1 — bounded outbox reads per booking aggregate. */
export const MAX_OUTBOX_EVENTS_PER_AGGREGATE = 100;

export const OUTBOX_EVENT_LIST_SELECT = {
  id: true,
  tenantId: true,
  aggregateType: true,
  aggregateId: true,
  eventType: true,
  payload: true,
  domainEventId: true,
  createdAt: true,
} as const;
