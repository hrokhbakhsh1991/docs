import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { deriveTourProjections } from "../canonical/projection-sync";
import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../db/background-admin-client";
import { logger } from "../observability/logger";
import { metricsRegistry } from "../observability/metrics";

export type ReconcileTourProjectionResult = {
  readonly scanned: number;
  readonly mismatches: number;
  readonly repaired: number;
};

export type ReconcileTourProjectionOptions = {
  readonly repair?: boolean;
};

function tourProjectionMatches(
  canonical: unknown,
  title: string | null,
  schemaVersion: number
): boolean {
  const expected = deriveTourProjections(canonical as CanonicalDocument);
  return title === expected.title && schemaVersion === expected.schemaVersion;
}

async function observeProjectionLag(
  tenantId: string,
  tourId: string,
  admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_OUTBOX_RECONCILE)
): Promise<void> {
  const outbox = await admin.outboxEvent.findFirst({
    where: {
      tenantId,
      aggregateId: tourId,
      eventType: "TourCreated",
      status: "done",
    },
    orderBy: { processedAt: "desc" },
  });

  const lagSeconds =
    outbox?.processedAt !== null && outbox?.processedAt !== undefined
      ? Math.max(0, (Date.now() - outbox.processedAt.getTime()) / 1000)
      : 0;

  metricsRegistry.observe("outbox_projection_lag_seconds", lagSeconds, {
    tenant_id: tenantId,
  });
}

/**
 * Repairs derived projection columns from canonical SoT (DEC-115).
 * Returns true when a row was updated.
 */
export async function repairTourProjectionIfDrifted(
  tenantId: string,
  tourId: string
): Promise<boolean> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_OUTBOX_RECONCILE);
  const tour = await admin.tour.findUnique({
    where: { tenantId_id: { tenantId, id: tourId } },
  });
  if (tour === null) {
    return false;
  }

  if (tourProjectionMatches(tour.canonical, tour.title, tour.schemaVersion)) {
    return false;
  }

  const expected = deriveTourProjections(tour.canonical as unknown as CanonicalDocument);
  await admin.tour.update({
    where: { tenantId_id: { tenantId, id: tourId } },
    data: {
      title: expected.title,
      schemaVersion: expected.schemaVersion,
    },
  });

  metricsRegistry.increment("projection_auto_repair_total", { tenant_id: tenantId });
  await observeProjectionLag(tenantId, tourId, admin);

  logger.info(
    {
      event: "projection.auto_repair",
      tenant_id: tenantId,
      tour_id: tourId,
    },
    "repaired tour projection columns from canonical"
  );

  return true;
}

/**
 * Scan tours for projection column drift vs canonical SoT (DEC-088).
 * Optionally repairs drifted rows (DEC-115).
 */
export async function reconcileTourProjectionsForTenant(
  tenantId: string,
  limit = 100,
  options?: ReconcileTourProjectionOptions
): Promise<ReconcileTourProjectionResult> {
  const repair = options?.repair === true;
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_OUTBOX_RECONCILE);
  const tours = await admin.tour.findMany({
    where: { tenantId },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let mismatches = 0;
  let repaired = 0;

  for (const tour of tours) {
    if (tourProjectionMatches(tour.canonical, tour.title, tour.schemaVersion)) {
      continue;
    }

    mismatches += 1;

    if (repair) {
      if (await repairTourProjectionIfDrifted(tenantId, tour.id)) {
        repaired += 1;
      }
      continue;
    }

    await observeProjectionLag(tenantId, tour.id, admin);

    logger.warn(
      {
        event: "projection.reconcile.mismatch",
        tenant_id: tenantId,
        tour_id: tour.id,
      },
      "tour projection columns diverge from canonical — manual reconcile required"
    );
  }

  return { scanned: tours.length, mismatches, repaired };
}
