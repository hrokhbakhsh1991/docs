/**
 * MNI-001 — fan-out tour schedule mutations to approved registration members.
 * Real producer: `emitTourMutationSideEffects` → `tour.mutation.notification_required`.
 */
import { normalizeDomainEventType } from "@app-tour/platform-events";

import { withTenantRls } from "../db/with-tenant-rls";
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { insertMemberNotificationRow } from "./member-notification.repository";

const TOUR_SCHEDULE_MAPPING = {
  sourceModule: "booking" as const,
  entityType: "registration" as const,
  templateId: "tour.schedule.changed",
  titleKey: "notification.tour.changed.title",
  bodyKey: "notification.tour.changed.body",
};

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

export async function dispatchTourScheduleNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow,
): Promise<void> {
  const canonicalEventType = normalizeDomainEventType(row.eventType);
  if (canonicalEventType !== "tour.schedule.changed") {
    return;
  }

  const payload = asRecord(row.payload);
  const tourId =
    typeof payload.tourId === "string" && payload.tourId.trim().length > 0
      ? payload.tourId.trim()
      : row.aggregateId;

  const registrations = await withTenantRls(row.tenantId, async (tx) =>
    tx.operatorRegistration.findMany({
      where: {
        tenantId: row.tenantId,
        tourId,
        status: "approved",
      },
      select: { id: true, submittedByUserId: true },
    }),
  );

  for (const registration of registrations) {
    const userId = registration.submittedByUserId;
    if (userId === null || userId.trim().length === 0) {
      continue;
    }
    await insertMemberNotificationRow({
      tenantId: row.tenantId,
      userId,
      sourceModule: TOUR_SCHEDULE_MAPPING.sourceModule,
      eventType: canonicalEventType,
      entityType: TOUR_SCHEDULE_MAPPING.entityType,
      entityId: registration.id,
      title: TOUR_SCHEDULE_MAPPING.titleKey,
      body: TOUR_SCHEDULE_MAPPING.bodyKey,
      titleKey: TOUR_SCHEDULE_MAPPING.titleKey,
      bodyKey: TOUR_SCHEDULE_MAPPING.bodyKey,
      templateKey: TOUR_SCHEDULE_MAPPING.templateId,
      dedupeKey: `${row.domainEventId}:${userId}`,
      payload: {
        ...payload,
        tourId,
        registrationId: registration.id,
        guestUserId: userId,
        eventType: canonicalEventType,
        sourceEventType: row.eventType,
        domainEventId: row.domainEventId,
      },
    });
  }
}
