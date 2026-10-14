import { randomUUID } from "node:crypto";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { Prisma } from "@prisma/client";

import { readDenaliFirstPhotoHttpsUrl } from "@app-tour/workspace-denali";

import { isPublicPublishStatusLabel } from "../../canonical/publish-status-labels";
import { readTourPublishStatusLabel } from "../../canonical/workspace-canonical-tour-dispatch";
import { withTenantRls } from "../../db/with-tenant-rls";
import { enqueueOutboxEvent } from "../../outbox/enqueue-domain-event";
import type { ToursService } from "../../tours/tours.service";
import { resolveWorkspaceTypeForTenant } from "../../tenant/resolve-workspace-type";

export const TOUR_TELEGRAM_ANNOUNCEMENT_EVENT = "TourAnnouncementRequested" as const;

export class TourTelegramAnnouncementNotFoundError extends Error {
  readonly code = "TOUR_NOT_FOUND";
}

export class TourTelegramAnnouncementNotPublishedError extends Error {
  readonly code = "TOUR_NOT_PUBLISHED";
}

/**
 * Queues an operator-requested announcement. The payload is a frozen snapshot
 * so later tour edits cannot silently change the message already approved by
 * the operator.
 */
export async function requestTourTelegramAnnouncement(
  auth: TenantAuthContext,
  toursService: ToursService,
  tourId: string,
  options: { readonly idempotencyKey?: string } = {}
): Promise<{ readonly eventId: string; readonly tourId: string }> {
  const record = await toursService.getTourById(auth, tourId);
  if (record === null) {
    throw new TourTelegramAnnouncementNotFoundError();
  }

  const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  const publishStatus = readTourPublishStatusLabel(workspaceType, record.canonical);
  if (!isPublicPublishStatusLabel(publishStatus)) {
    throw new TourTelegramAnnouncementNotPublishedError();
  }

  const eventId =
    options.idempotencyKey === undefined
      ? `${TOUR_TELEGRAM_ANNOUNCEMENT_EVENT}:${record.id}:${randomUUID()}`
      : `${TOUR_TELEGRAM_ANNOUNCEMENT_EVENT}:${record.id}:${options.idempotencyKey}`;
  const data =
    record.canonical.data !== null &&
    typeof record.canonical.data === "object" &&
    !Array.isArray(record.canonical.data)
      ? record.canonical.data
      : {};
  const title = typeof data.title === "string" ? data.title : record.id;
  const telegramMediaUrl = readDenaliFirstPhotoHttpsUrl(data.photos ?? data.photosData);

  await withTenantRls(auth.tenantId, async (tx) => {
    await enqueueOutboxEvent(tx, {
      tenantId: auth.tenantId,
      aggregateType: "tour",
      aggregateId: record.id,
      eventType: TOUR_TELEGRAM_ANNOUNCEMENT_EVENT,
      domainEventId: eventId,
      payload: {
        schemaVersion: 1,
        tenantId: auth.tenantId,
        tourId: record.id,
        title,
        requestedBy: auth.userId,
        requestedAt: new Date().toISOString(),
        deliverySnapshot: data,
        ...(telegramMediaUrl === null ? {} : { telegramMediaKind: "photo", telegramMediaUrl }),
        // Keep the first version deterministic and compact. The workspace
        // renderer can replace this template without touching Telegram code.
        integrationDeliveryMessageTemplate: "🆕 تور جدید منتشر شد\n\n🏕 عنوان تور: {{title}}",
      } as Prisma.InputJsonValue,
    });
  });

  return { eventId, tourId: record.id };
}
