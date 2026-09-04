import { getNotificationDeliveryPort } from "../notifications/create-notification-delivery";
import {
  claimPendingTicketNotificationDeliveries,
  markTicketNotificationDeliveryResult,
} from "../workspace-ticketing/ticket-notification.repository";

export async function processTicketNotificationDeliveriesForTenantOnce(
  tenantId: string,
  batchSize = 10,
): Promise<{ readonly processed: number; readonly failed: number }> {
  const deliveries = await claimPendingTicketNotificationDeliveries(tenantId, batchSize);
  const port = getNotificationDeliveryPort();
  let processed = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const result = await port.deliver({
      tenantId,
      channel: delivery.channel === "sms" ? "sms" : "email",
      templateId: `ticketing.${delivery.eventType}`,
      recipient: { userId: delivery.userId },
      payload: {
        ticketId: delivery.ticketId,
        title: delivery.title,
        body: delivery.body,
        eventType: delivery.eventType,
      },
      correlationId: delivery.domainEventId,
    });

    if (result.ok) {
      processed += 1;
      await markTicketNotificationDeliveryResult(tenantId, delivery.id, { ok: true });
    } else {
      failed += 1;
      await markTicketNotificationDeliveryResult(tenantId, delivery.id, {
        ok: false,
        retryable: result.retryable,
        error: result.retryable ? "DELIVERY_RETRYABLE" : "DELIVERY_FAILED",
      });
    }
  }

  return { processed, failed };
}
