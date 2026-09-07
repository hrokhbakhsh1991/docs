/**
 * MNI-001 — fan-out tour execution changes to approved registration members.
 */
import { normalizeDomainEventType } from "@app-tour/platform-events";

import { withTenantRls } from "../db/with-tenant-rls";
import type { WorkspaceOutboxPublishedRow } from "../workspace/workspace-outbox-row-context.ts";
import { insertMemberNotificationRow } from "./member-notification.repository";

const EXECUTION_NOTIFICATION_TYPES = new Set([
  "tour.execution.started",
  "tour.execution.completed",
  "tour.execution.change.notified",
]);

const EXECUTION_MAPPING = {
  sourceModule: "booking" as const,
  entityType: "registration" as const,
  templateByEvent: {
    "tour.execution.started": "tour.execution.started",
    "tour.execution.completed": "tour.execution.completed",
    "tour.execution.change.notified": "tour.execution.change.notified",
  } as const,
};

function asRecord(payload: unknown): Readonly<Record<string, unknown>> {
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Readonly<Record<string, unknown>>;
  }
  return {};
}

export async function dispatchTourExecutionNotificationFromOutbox(
  row: WorkspaceOutboxPublishedRow,
): Promise<void> {
  const canonicalEventType = normalizeDomainEventType(row.eventType);
  if (!EXECUTION_NOTIFICATION_TYPES.has(canonicalEventType)) {
    return;
  }

  const payload = asRecord(row.payload);
  const tourId =
    typeof payload.tourId === "string" && payload.tourId.trim().length > 0
      ? payload.tourId.trim()
      : row.aggregateId;

  const templateId =
    EXECUTION_MAPPING.templateByEvent[
      canonicalEventType as keyof typeof EXECUTION_MAPPING.templateByEvent
    ] ?? canonicalEventType;

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
      sourceModule: EXECUTION_MAPPING.sourceModule,
      eventType: canonicalEventType,
      entityType: EXECUTION_MAPPING.entityType,
      entityId: registration.id,
      title: `notification.${templateId}.title`,
      body: `notification.${templateId}.body`,
      titleKey: `notification.${templateId}.title`,
      bodyKey: `notification.${templateId}.body`,
      templateKey: templateId,
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
