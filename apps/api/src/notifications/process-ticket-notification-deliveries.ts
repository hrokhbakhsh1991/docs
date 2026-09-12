import { getNotificationDeliveryPort } from "../notifications/create-notification-delivery";
import {
  claimPendingMemberNotificationDeliveries,
  markMemberNotificationDeliveryResult,
} from "./member-notification.repository";

export async function processTicketNotificationDeliveriesForTenantOnce(
  tenantId: string,
  batchSize = 10,
): Promise<{ readonly processed: number; readonly failed: number }> {
  const deliveries = await claimPendingMemberNotificationDeliveries(tenantId, batchSize);
  const port = getNotificationDeliveryPort();
  let processed = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const result = await port.deliver({
      tenantId,
      channel: delivery.channel === "sms" ? "sms" : "email",
      templateId: `${delivery.sourceModule}.${delivery.eventType}`,
      recipient: { userId: delivery.userId },
      payload: {
        entityType: delivery.entityType,
        entityId: delivery.entityId,
        title: delivery.title,
        body: delivery.body,
        eventType: delivery.eventType,
        sourceModule: delivery.sourceModule,
      },
      correlationId: delivery.dedupeKey,
    });

    if (result.ok) {
      processed += 1;
      await markMemberNotificationDeliveryResult(tenantId, delivery.id, { ok: true });
    } else {
      failed += 1;
      await markMemberNotificationDeliveryResult(tenantId, delivery.id, {
        ok: false,
        retryable: result.retryable,
        error: result.retryable ? "DELIVERY_RETRYABLE" : "DELIVERY_FAILED",
      });
    }
  }

  return { processed, failed };
}
