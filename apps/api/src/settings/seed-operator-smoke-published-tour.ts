import {
  OPERATOR_SMOKE_DRAFT_TOUR_ID,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
  OPERATOR_SMOKE_SEED_TOUR_ID,
  OPERATOR_SMOKE_PUBLISHED_TOUR_POLICIES_TEXT,
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
  buildDenaliClubDevPublishedTour,
  buildOperatorSmokeDraftTour,
  buildOperatorSmokeParticipantRequirementsTour,
  buildOperatorSmokePublishedTour,
  buildOperatorSmokeTransportBusTour,
  buildOperatorSmokeTransportSharedCarsTour,
  DENALI_CLUB_DEV_PUBLISHED_TOUR_ID,
} from "../fixtures/operator-smoke-published-tour.fixture";
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";
import { OPERATOR_SMOKE_TENANT_ID } from "./seed-operator-smoke-catalog";
import { getPrismaAdmin } from "../db/prisma";
import { logger } from "../observability/logger";
import { PrismaTourRepository } from "../storage/prisma-tour.repository";

/** Idempotent Prisma seed — published tour for denali.club dev tenant (…000003). */
export async function seedDenaliClubDevPublishedTour(tenantId: string): Promise<void> {
  if (tenantId !== DENALI_SMOKE_TENANT_ID) {
    throw new Error("DENALI_CLUB_DEV_TOUR_SEED_TENANT_MISMATCH");
  }

  const repo = new PrismaTourRepository();
  const existing = await repo.getById(DENALI_CLUB_DEV_PUBLISHED_TOUR_ID, tenantId);
  if (existing !== null) {
    return;
  }

  await repo.save(buildDenaliClubDevPublishedTour({ tenantId }));
  logger.info(
    {
      event: "db.seed.denali_club_dev_published_tour",
      tenantId,
      tourId: DENALI_CLUB_DEV_PUBLISHED_TOUR_ID,
    },
    "denali club dev published tour seeded"
  );
}

/** Idempotent Prisma seed — multi-day published tour for operator/denali dev smoke. */
export async function seedOperatorSmokePublishedTour(tenantId: string): Promise<void> {
  if (tenantId === DENALI_SMOKE_TENANT_ID) {
    await seedDenaliClubDevPublishedTour(tenantId);
    return;
  }

  const repo = new PrismaTourRepository();
  const existing = await repo.getById(OPERATOR_SMOKE_SEED_TOUR_ID, tenantId);
  if (existing !== null) {
    return;
  }

  const globalRow = await getPrismaAdmin().tour.findFirst({
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

/** Idempotent — participant-requirements tour for DEN-INTAKE / DEN-PROF staging (…000212). */
export async function seedOperatorSmokeParticipantRequirementsTour(tenantId: string): Promise<void> {
  const repo = new PrismaTourRepository();
  const existing = await repo.getById(OPERATOR_SMOKE_PARTICIPANT_TOUR_ID, tenantId);
  if (existing !== null) {
    return;
  }

  await repo.save(buildOperatorSmokeParticipantRequirementsTour({ tenantId }));
  logger.info(
    {
      event: "db.seed.operator_smoke_participant_tour",
      tenantId,
      tourId: OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
    },
    "operator smoke participant-requirements tour seeded"
  );
}

/** Idempotent — transport smoke tours for DEN-TRANS staging (…000213 bus · …000214 shared_cars). */
export async function seedOperatorSmokeTransportTours(tenantId: string): Promise<void> {
  const repo = new PrismaTourRepository();

  const bus = await repo.getById(OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, tenantId);
  if (bus === null) {
    await repo.save(buildOperatorSmokeTransportBusTour({ tenantId }));
    logger.info(
      {
        event: "db.seed.operator_smoke_transport_bus_tour",
        tenantId,
        tourId: OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
      },
      "operator smoke transport (bus) tour seeded"
    );
  }

  const shared = await repo.getById(OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID, tenantId);
  if (shared === null) {
    await repo.save(buildOperatorSmokeTransportSharedCarsTour({ tenantId }));
    logger.info(
      {
        event: "db.seed.operator_smoke_transport_shared_cars_tour",
        tenantId,
        tourId: OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
      },
      "operator smoke transport (shared_cars) tour seeded"
    );
  }
}
