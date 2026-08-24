/**
 * DP-4 — map outbox events to member notification inbox (provider-independent).
 */
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { insertMemberNotificationInboxRow } from "./member-notification-inbox.repository.ts";

const MEMBER_NOTIFICATION_EVENT_MAP: Readonly<
  Record<
    string,
    { readonly templateId: string; readonly titleKey: string; readonly bodyKey: string }
  >
> = Object.freeze({
  "registration.approved": {
    templateId: "booking.registration.approved",
    titleKey: "notification.registration.approved.title",
    bodyKey: "notification.registration.approved.body",
  },
  "registration.waitlisted": {
    templateId: "booking.registration.waitlisted",
    titleKey: "notification.registration.waitlisted.title",
    bodyKey: "notification.registration.waitlisted.body",
  },
  "registration.cancelled": {
    templateId: "booking.registration.cancelled",
    titleKey: "notification.registration.cancelled.title",
    bodyKey: "notification.registration.cancelled.body",
  },
  "registration.rejected": {
    templateId: "booking.registration.rejected",
    titleKey: "notification.registration.rejected.title",
    bodyKey: "notification.registration.rejected.body",
  },
  "payment.hold.scheduled": {
    templateId: "finance.payment.hold.scheduled",
    titleKey: "notification.payment.due.title",
    bodyKey: "notification.payment.due.body",
  },
  "payment.hold.expired": {
    templateId: "finance.payment.hold.expired",
    titleKey: "notification.payment.expired.title",
    bodyKey: "notification.payment.expired.body",
  },
  "tour.mutation.notification_required": {
    templateId: "tour.mutation.notification",
    titleKey: "notification.tour.changed.title",
    bodyKey: "notification.tour.changed.body",
  },
});

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

function resolveRecipientUserId(payload: Readonly<Record<string, unknown>>): string | null {
  const guestUserId = payload.guestUserId;
  if (typeof guestUserId === "string" && guestUserId.trim().length > 0) {
    return guestUserId.trim();
  }
  const submittedByUserId = payload.submittedByUserId;
  if (typeof submittedByUserId === "string" && submittedByUserId.trim().length > 0) {
    return submittedByUserId.trim();
  }
  return null;
}

export async function dispatchMemberNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow
): Promise<void> {
  const mapping = MEMBER_NOTIFICATION_EVENT_MAP[row.eventType];
  if (mapping === undefined) {
    return;
  }

  const payload = asRecord(row.payload);
  const userId = resolveRecipientUserId(payload);
  if (userId === null) {
    return;
  }

  insertMemberNotificationInboxRow({
    tenantId: row.tenantId,
    userId,
    templateId: mapping.templateId,
    titleKey: mapping.titleKey,
    bodyKey: mapping.bodyKey,
    payload: {
      ...payload,
      eventType: row.eventType,
      domainEventId: row.domainEventId,
    },
    correlationId: row.domainEventId,
  });
}
