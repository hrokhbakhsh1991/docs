/**
 * SK2 composed delivery — routes channel to in_app / sms adapters.
 */

import { InAppStructuredNotificationAdapter } from "./in-app-structured-notification.adapter";
import type {
  NotificationCommand,
  NotificationDeliveryPort,
  NotificationDeliveryResult,
} from "./notification-delivery.port";
import { SmsNotificationAdapter } from "./sms-notification.adapter";

export class ComposedNotificationDeliveryPort implements NotificationDeliveryPort {
  readonly inApp: InAppStructuredNotificationAdapter;
  readonly sms: SmsNotificationAdapter;

  constructor(
    inApp: InAppStructuredNotificationAdapter = new InAppStructuredNotificationAdapter(),
    sms: SmsNotificationAdapter = new SmsNotificationAdapter(),
  ) {
    this.inApp = inApp;
    this.sms = sms;
  }

  async deliver(command: NotificationCommand): Promise<NotificationDeliveryResult> {
    if (command.channel === "in_app") {
      return this.inApp.deliver(command);
    }
    if (command.channel === "sms") {
      return this.sms.deliver(command);
    }
    return { ok: false, retryable: false };
  }
}

export function createDefaultNotificationDeliveryPort(): ComposedNotificationDeliveryPort {
  return new ComposedNotificationDeliveryPort();
}
