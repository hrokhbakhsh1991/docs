import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import { withTenantRls } from "../db/with-tenant-rls";

export async function enqueueScheduleItemWaivedAudit(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly itemId: string;
  readonly reason: string;
  readonly actorUserId: string;
}): Promise<void> {
  const tenantId = input.tenantId.trim();
  const registrationId = input.registrationId.trim();
  const itemId = input.itemId.trim();
  const domainEventId = `finance.schedule.item_waived:${itemId}`;

  await withTenantRls(tenantId, async (tx) => {
    await enqueueOutboxEvent(tx, {
      tenantId,
      aggregateType: "finance_schedule",
      aggregateId: registrationId,
      eventType: "finance.schedule.item_waived",
      domainEventId,
      payload: {
        registrationId,
        itemId,
        reason: input.reason.trim(),
        actorUserId: input.actorUserId.trim(),
      },
    });
  });
}
