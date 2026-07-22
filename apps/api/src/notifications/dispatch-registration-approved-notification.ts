/**
 * Maps durable outbox `registration.approved` → NotificationDeliveryPort.
 * Gated by `TenantFeatureFlags.inAppRegistrationApprovedNotify` (SK3).
 */

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { resolveTenantFeatureFlags } from "../tenant/resolve-tenant-feature-flags";
import type { TenantFeatureFlags } from "../tenant/resolve-tenant-feature-flags";
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context";
import { getNotificationDeliveryPort } from "./create-notification-delivery";
import type {
  NotificationDeliveryPort,
  NotificationDeliveryResult,
} from "./notification-delivery.port";

export const BOOKING_REGISTRATION_APPROVED_TEMPLATE_ID = "booking.registration.approved";

export type DispatchRegistrationApprovedNotificationDeps = {
  readonly delivery?: NotificationDeliveryPort;
  readonly resolveFlags?: (tenantId: string) => Promise<TenantFeatureFlags>;
};

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/**
 * @returns `null` when event is not handled or flag-gated off; otherwise delivery result.
 */
export async function dispatchRegistrationApprovedNotification(
  row: WorkspaceOutboxPublishedRow,
  deps: DispatchRegistrationApprovedNotificationDeps = {}
): Promise<NotificationDeliveryResult | null> {
  if (row.eventType !== BOOKING_APPROVE_OUTBOX_EVENT_TYPE) {
    return null;
  }

  const resolveFlags = deps.resolveFlags ?? resolveTenantFeatureFlags;
  const flags = await resolveFlags(row.tenantId);
  if (!flags.inAppRegistrationApprovedNotify) {
    return null;
  }

  const payload = asRecord(row.payload);
  const delivery = deps.delivery ?? getNotificationDeliveryPort();

  return delivery.deliver({
    tenantId: row.tenantId,
    channel: "in_app",
    templateId: BOOKING_REGISTRATION_APPROVED_TEMPLATE_ID,
    recipient: {
      ...(optionalString(payload.guestEmail) !== undefined
        ? { address: optionalString(payload.guestEmail) }
        : {}),
      ...(optionalString(payload.guestUserId) !== undefined
        ? { userId: optionalString(payload.guestUserId) }
        : {}),
    },
    payload: {
      bookingId: payload.bookingId ?? row.aggregateId,
      tourId: payload.tourId,
      status: payload.status,
      approvedAt: payload.approvedAt,
      eventType: row.eventType,
      domainEventId: row.domainEventId,
    },
    correlationId: row.domainEventId,
  });
}
