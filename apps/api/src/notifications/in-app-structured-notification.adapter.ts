/**
 * First SK2.C adapter — in_app structured sink with process-local idempotency.
 * Not SMTP/SMS; real call site from outbox relay for registration.approved.
 */

import { logger } from "../observability/logger";
import type {
  NotificationCommand,
  NotificationDeliveryPort,
  NotificationDeliveryResult,
} from "./notification-delivery.port";
import {
  NOTIFICATION_CORRELATION_REQUIRED,
  NOTIFICATION_TENANT_REQUIRED,
} from "./notification-delivery.port";

function idempotencyKey(command: NotificationCommand): string {
  return `${command.tenantId}\0${command.correlationId}\0${command.channel}`;
}

export class InAppStructuredNotificationAdapter implements NotificationDeliveryPort {
  private readonly delivered = new Set<string>();

  async deliver(command: NotificationCommand): Promise<NotificationDeliveryResult> {
    if (!command.tenantId.trim()) {
      throw new Error(NOTIFICATION_TENANT_REQUIRED);
    }
    if (!command.correlationId.trim()) {
      throw new Error(NOTIFICATION_CORRELATION_REQUIRED);
    }

    const key = idempotencyKey(command);
    if (this.delivered.has(key)) {
      return { ok: true };
    }

    logger.info(
      {
        event: "notification.delivered",
        channel: command.channel,
        template_id: command.templateId,
        tenant_id: command.tenantId,
        correlation_id: command.correlationId,
        recipient_user_id: command.recipient.userId,
        recipient_address: command.recipient.address,
        payload: command.payload,
      },
      "notification delivered (in_app structured)"
    );

    this.delivered.add(key);
    return { ok: true };
  }

  /** Test / reset helper — not for production composition. */
  resetForTests(): void {
    this.delivered.clear();
  }

  /** Test helper — how many distinct deliveries were sunk. */
  deliveredCountForTests(): number {
    return this.delivered.size;
  }
}
