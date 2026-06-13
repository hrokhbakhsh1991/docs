import {
  OPERATOR_SMOKE_SEED_TOUR_ID,
  buildOperatorSmokePublishedTour,
} from "../fixtures/operator-smoke-published-tour.fixture";
import { logger } from "../observability/logger";
import { PrismaTourRepository } from "../storage/prisma-tour.repository";

/** Idempotent Prisma seed — multi-day published tour for operator/denali dev smoke. */
export async function seedOperatorSmokePublishedTour(tenantId: string): Promise<void> {
  const repo = new PrismaTourRepository();
  const existing = await repo.getById(OPERATOR_SMOKE_SEED_TOUR_ID, tenantId);
  if (existing !== null) {
    return;
  }

  await repo.save(buildOperatorSmokePublishedTour({ tenantId }));
  logger.info(
    { event: "db.seed.operator_smoke_published_tour", tenantId, tourId: OPERATOR_SMOKE_SEED_TOUR_ID },
    "operator smoke published tour seeded"
  );
}
