/**
 * DP-4 / MNI-001 — map outbox events to shared member notification inbox.
 */
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { insertMemberNotificationRow } from "./member-notification.repository";
import type {
  MemberNotificationEntityType,
  MemberNotificationSourceModule,
} from "./member-notification.types";

const MEMBER_NOTIFICATION_EVENT_MAP: Readonly<
  Record<
    string,
    {
      readonly sourceModule: MemberNotificationSourceModule;
      readonly entityType: MemberNotificationEntityType;
      readonly templateId: string;
      readonly titleKey: string;
      readonly bodyKey: string;
    }
  >
> = Object.freeze({
  "registration.approved": {
    sourceModule: "booking",
    entityType: "registration",
    templateId: "booking.registration.approved",
    titleKey: "notification.registration.approved.title",
    bodyKey: "notification.registration.approved.body",
  },
  "registration.waitlisted": {
    sourceModule: "booking",
    entityType: "registration",
    templateId: "booking.registration.waitlisted",
    titleKey: "notification.registration.waitlisted.title",
    bodyKey: "notification.registration.waitlisted.body",
  },
  "registration.cancelled": {
    sourceModule: "booking",
    entityType: "registration",
    templateId: "booking.registration.cancelled",
    titleKey: "notification.registration.cancelled.title",
    bodyKey: "notification.registration.cancelled.body",
  },
  "registration.rejected": {
    sourceModule: "booking",
    entityType: "registration",
    templateId: "booking.registration.rejected",
    titleKey: "notification.registration.rejected.title",
    bodyKey: "notification.registration.rejected.body",
  },
  "payment.hold.scheduled": {
    sourceModule: "finance",
    entityType: "payment",
    templateId: "finance.payment.hold.scheduled",
    titleKey: "notification.payment.due.title",
    bodyKey: "notification.payment.due.body",
  },
  "payment.hold.expired": {
    sourceModule: "finance",
    entityType: "payment",
    templateId: "finance.payment.hold.expired",
    titleKey: "notification.payment.expired.title",
    bodyKey: "notification.payment.expired.body",
  },
  "tour.mutation.notification_required": {
    sourceModule: "booking",
    entityType: "registration",
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

function resolveEntityId(
  payload: Readonly<Record<string, unknown>>,
  entityType: MemberNotificationEntityType,
  aggregateId: string,
): string | null {
  if (entityType === "registration") {
    const registrationId = payload.registrationId ?? payload.bookingId ?? aggregateId;
    return typeof registrationId === "string" ? registrationId : null;
  }
  if (entityType === "payment") {
    const paymentId = payload.paymentId ?? payload.bookingId;
    return typeof paymentId === "string" ? paymentId : null;
  }
  return null;
}

export async function dispatchMemberNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow,
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

  await insertMemberNotificationRow({
    tenantId: row.tenantId,
    userId,
    sourceModule: mapping.sourceModule,
    eventType: row.eventType,
    entityType: mapping.entityType,
    entityId: resolveEntityId(payload, mapping.entityType, row.aggregateId),
    title: mapping.titleKey,
    body: mapping.bodyKey,
    titleKey: mapping.titleKey,
    bodyKey: mapping.bodyKey,
    templateKey: mapping.templateId,
    dedupeKey: row.domainEventId,
    payload: {
      ...payload,
      eventType: row.eventType,
      domainEventId: row.domainEventId,
    },
  });
}
