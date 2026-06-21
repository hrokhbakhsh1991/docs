import type { Prisma } from "@prisma/client";
import type { OutboxWriter } from "@app-tour/workspace-denali";

import { withTenantRls } from "../db/with-tenant-rls";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";

export function createPrismaWorkspaceOutboxWriter(): OutboxWriter {
  return {
    async addEvent(event) {
      await withTenantRls(event.tenantId, async (tx) => {
        await enqueueOutboxEvent(tx, {
          tenantId: event.tenantId,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          payload: event.payload as Prisma.InputJsonValue,
          domainEventId: event.domainEventId,
        });
      });
    },
  };
}
