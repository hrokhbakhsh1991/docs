import type { Prisma } from "@prisma/client";

import { appendBookingOutboxEventIfAbsent } from "../bookings/in-memory-bookings.repository.ts";
import { persistStandaloneOutboxRowIfPrismaDriver } from "./persist-standalone-outbox-row.ts";

/** Finance/booking side-effect outbox — Prisma standalone row or memory buffer fallback. */
export async function persistBookingFinanceOutboxEventIfAbsent(input: {
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly domainEventId: string;
}): Promise<void> {
  const persisted = await persistStandaloneOutboxRowIfPrismaDriver({
    tenantId: input.tenantId,
    aggregateType: "registration",
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload as Prisma.InputJsonValue,
    domainEventId: input.domainEventId,
  });
  if (persisted) {
    return;
  }
  appendBookingOutboxEventIfAbsent(input);
}
