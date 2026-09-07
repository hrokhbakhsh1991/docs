/**
 * SK2 SMS adapter — port-only; real provider disabled unless SMS_ENABLED=true.
 * @see docs/standards/shared-domain-event-contract.mdoc
 * @see docs/standards/member-notification-inbox.mdoc
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

export const SMS_NOTIFICATION_DISABLED = "SMS_NOTIFICATION_DISABLED";

/** Default false — no credentials, no fake delivery. */
export function isSmsNotificationEnabled(): boolean {
  const raw = process.env.SMS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export class SmsNotificationAdapter implements NotificationDeliveryPort {
  async deliver(command: NotificationCommand): Promise<NotificationDeliveryResult> {
    if (command.channel !== "sms") {
      return { ok: false, retryable: false };
    }
    if (!command.tenantId.trim()) {
      throw new Error(NOTIFICATION_TENANT_REQUIRED);
    }
    if (!command.correlationId.trim()) {
      throw new Error(NOTIFICATION_CORRELATION_REQUIRED);
    }

    if (!isSmsNotificationEnabled()) {
      logger.info(
        {
          event: "notification.sms.skipped",
          reason: SMS_NOTIFICATION_DISABLED,
          tenant_id: command.tenantId,
          correlation_id: command.correlationId,
          template_id: command.templateId,
        },
        "sms delivery skipped — SMS_ENABLED=false",
      );
      return { ok: false, retryable: false };
    }

    // Provider hook reserved for future real SMS integration without domain model changes.
    return { ok: false, retryable: false };
  }
}
