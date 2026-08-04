import type { Prisma } from "@prisma/client";

import { readTourCapLimits } from "../db/tour-cap-config";
import { TourCapacityExceededError, tourCapacityErrorMessage } from "../db/tour-capacity.error";

/** Capacity check inside {@link withCanonicalTransaction} — same connection as persist. */
export async function assertTourCapacityInTx(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  const limits = readTourCapLimits();
  const rows = await tx.$queryRaw<Array<{ global_count: bigint; tenant_count: bigint }>>`
    SELECT
      count(*) AS global_count,
      count(*) FILTER (WHERE tenant_id = ${tenantId}::uuid) AS tenant_count
    FROM tours
  `;
  const globalCount = Number(rows[0]?.global_count ?? 0n);
  const tenantCount = Number(rows[0]?.tenant_count ?? 0n);

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
