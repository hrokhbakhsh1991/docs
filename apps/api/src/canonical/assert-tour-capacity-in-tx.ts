import type { Prisma } from "@prisma/client";

import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";

/** Capacity check inside {@link withCanonicalTransaction} — same connection as persist. */
export async function assertTourCapacityInTx(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  const limits = readTourCapLimits();
  const [globalCount, tenantCount] = await Promise.all([
    tx.tour.count(),
    tx.tour.count({ where: { tenantId } }),
  ]);

  if (globalCount >= limits.maxGlobal) {
    throw new TourCapacityExceededError(
      "TOUR_CAPACITY_GLOBAL",
      tourCapacityErrorMessage("TOUR_CAPACITY_GLOBAL")
    );
  }
  if (tenantCount >= limits.maxPerTenant) {
    throw new TourCapacityExceededError(
      "TOUR_CAPACITY_TENANT",
      tourCapacityErrorMessage("TOUR_CAPACITY_TENANT")
    );
  }
}
