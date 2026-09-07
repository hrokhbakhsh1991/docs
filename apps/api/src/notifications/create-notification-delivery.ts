import {
  ComposedNotificationDeliveryPort,
  createDefaultNotificationDeliveryPort,
} from "./composed-notification-delivery.port";
import { InAppStructuredNotificationAdapter } from "./in-app-structured-notification.adapter";
import type { NotificationDeliveryPort } from "./notification-delivery.port";

let singleton: NotificationDeliveryPort | null = null;
let inAppSingleton: InAppStructuredNotificationAdapter | null = null;

export function getNotificationDeliveryPort(): NotificationDeliveryPort {
  if (singleton !== null) {
    return singleton;
  }
  const composed = createDefaultNotificationDeliveryPort();
  inAppSingleton = composed.inApp;
  singleton = composed;
  return singleton;
}

/** Test-only: replace or clear the composed port. */
export function setNotificationDeliveryPortForTests(
  port: NotificationDeliveryPort | null,
): void {
  singleton = port;
  if (port instanceof ComposedNotificationDeliveryPort) {
    inAppSingleton = port.inApp;
  } else if (port instanceof InAppStructuredNotificationAdapter) {
    inAppSingleton = port;
  } else if (port === null) {
    inAppSingleton = null;
  }
}

export function resetNotificationDeliveryForTests(): void {
  inAppSingleton?.resetForTests();
  singleton = null;
  inAppSingleton = null;
}

export function getInAppNotificationAdapterForTests(): InAppStructuredNotificationAdapter | null {
  return inAppSingleton;
}
