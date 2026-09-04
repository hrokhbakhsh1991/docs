/**
 * DP-4 / MNI-001 — map outbox events to shared member notification inbox.
 * Uses SDE-001 canonical event types after alias normalization.
 */
import { normalizeDomainEventType } from "@app-tour/platform-events";

import { withTenantRls } from "../db/with-tenant-rls";
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
  "payment.confirmed": {
    sourceModule: "finance",
    entityType: "payment",
    templateId: "finance.payment.confirmed",
    titleKey: "notification.payment.confirmed.title",
    bodyKey: "notification.payment.confirmed.body",
  },
  "attendance.marked": {
    sourceModule: "booking",
    entityType: "registration",
    templateId: "booking.attendance.marked",
    titleKey: "notification.attendance.marked.title",
    bodyKey: "notification.attendance.marked.body",
  },
  "tour.schedule.changed": {
    sourceModule: "booking",
    entityType: "registration",
    templateId: "tour.schedule.changed",
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
  const userId = payload.userId ?? payload.memberUserId;
  if (typeof userId === "string" && userId.trim().length > 0) {
    return userId.trim();
  }
  return null;
}

async function resolveRegistrationMemberUserId(
  tenantId: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<string | null> {
  const direct = resolveRecipientUserId(payload);
  if (direct !== null) {
    return direct;
  }
  const registrationId = payload.registrationId ?? payload.bookingId;
  if (typeof registrationId !== "string" || registrationId.trim().length === 0) {
    return null;
  }
  if (process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma") {
    return null;
  }
  return withTenantRls(tenantId, async (tx) => {
    const registration = await tx.operatorRegistration.findFirst({
      where: { tenantId, id: registrationId.trim() },
      select: { submittedByUserId: true },
    });
    return registration?.submittedByUserId ?? null;
  });
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
    const paymentId = payload.paymentId ?? payload.bookingId ?? payload.registrationId;
    return typeof paymentId === "string" ? paymentId : aggregateId.length > 0 ? aggregateId : null;
  }
  return null;
}

export async function dispatchMemberNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow,
): Promise<void> {
  const canonicalEventType = normalizeDomainEventType(row.eventType);
  const mapping = MEMBER_NOTIFICATION_EVENT_MAP[canonicalEventType];
  if (mapping === undefined) {
    return;
  }

  const payload = asRecord(row.payload);
  const userId = await resolveRegistrationMemberUserId(row.tenantId, payload);
  if (userId === null) {
    return;
  }

  await insertMemberNotificationRow({
    tenantId: row.tenantId,
    userId,
    sourceModule: mapping.sourceModule,
    eventType: canonicalEventType,
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
      eventType: canonicalEventType,
      sourceEventType: row.eventType,
      domainEventId: row.domainEventId,
    },
  });
}
