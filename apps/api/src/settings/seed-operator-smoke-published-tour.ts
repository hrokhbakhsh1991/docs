import {
  OPERATOR_SMOKE_DRAFT_TOUR_ID,
  OPERATOR_SMOKE_SEED_TOUR_ID,
  OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
  buildOperatorSmokeDraftTour,
  buildOperatorSmokePublishedTour,
} from "../fixtures/operator-smoke-published-tour.fixture";
import { OPERATOR_SMOKE_TENANT_ID } from "./seed-operator-smoke-catalog";
import { getPrismaAdmin } from "../db/prisma";
import { logger } from "../observability/logger";
import { PrismaTourRepository } from "../storage/prisma-tour.repository";

/** Idempotent Prisma seed — multi-day published tour for operator/denali dev smoke. */
export async function seedOperatorSmokePublishedTour(tenantId: string): Promise<void> {
  const repo = new PrismaTourRepository();
  const existing = await repo.getById(OPERATOR_SMOKE_SEED_TOUR_ID, tenantId);
  if (existing !== null) {
    return;
  }

  const globalRow = await getPrismaAdmin().tour.findUnique({
    where: { id: OPERATOR_SMOKE_SEED_TOUR_ID },
    select: { tenantId: true },
  });
  if (globalRow !== null && globalRow.tenantId !== tenantId) {
    if (globalRow.tenantId === OPERATOR_SMOKE_TENANT_ID) {
      // P7 staging: operator tenant …014 owns seed tour id — denyali dev bootstrap must not relocate it.
      return;
    }
    await getPrismaAdmin().tour.delete({ where: { id: OPERATOR_SMOKE_SEED_TOUR_ID } });
    logger.info(
      {
        event: "db.seed.operator_smoke_published_tour_relocate",
        tourId: OPERATOR_SMOKE_SEED_TOUR_ID,
        fromTenantId: globalRow.tenantId,
        toTenantId: tenantId,
      },
      "relocated smoke tour id to canonical operator tenant"
    );
  }

  await repo.save(buildOperatorSmokePublishedTour({ tenantId }));
  logger.info(
    { event: "db.seed.operator_smoke_published_tour", tenantId, tourId: OPERATOR_SMOKE_SEED_TOUR_ID },
    "operator smoke published tour seeded"
  );
}

/** Idempotent — backfill policies on existing smoke tour (P7-1-N-008). */
export async function ensureOperatorSmokePublishedTourPolicies(tenantId: string): Promise<void> {
  const repo = new PrismaTourRepository();
  const existing = await repo.getById(OPERATOR_SMOKE_SEED_TOUR_ID, tenantId);
  if (existing === null) {
    return;
  }

  const canonical = structuredClone(existing.canonical);
  const data = canonical.data as Record<string, unknown>;
  const policies = (isRecord(data.policies) ? data.policies : {}) as Record<string, unknown>;
  if (policies.policiesText === OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT) {
    return;
  }

  data.policies = {
    ...policies,
    policiesText: OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
    cancellationDeadlineHours: 48,
    cancellationPenaltyPercentage: 20,
  };

  await repo.save({
    ...existing,
    rowVersion: existing.rowVersion + 1,
    canonical,
  });
  logger.info(
    {
      event: "db.seed.operator_smoke_published_tour_policies",
      tenantId,
      tourId: OPERATOR_SMOKE_SEED_TOUR_ID,
    },
    "operator smoke published tour policies backfilled"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Idempotent — draft tour hidden from public catalog (P7-1-N-009 / SMK-P6-VS-01). */
export async function seedOperatorSmokeDraftTour(tenantId: string): Promise<void> {
  const repo = new PrismaTourRepository();
  const existing = await repo.getById(OPERATOR_SMOKE_DRAFT_TOUR_ID, tenantId);
  if (existing !== null) {
    return;
  }

  await repo.save(buildOperatorSmokeDraftTour({ tenantId }));
  logger.info(
    {
      event: "db.seed.operator_smoke_draft_tour",
      tenantId,
      tourId: OPERATOR_SMOKE_DRAFT_TOUR_ID,
    },
    "operator smoke draft tour seeded"
  );
}
