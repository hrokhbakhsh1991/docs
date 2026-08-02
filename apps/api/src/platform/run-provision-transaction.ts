import type { Prisma } from "@prisma/client";

import {
  PLATFORM_ADMIN_REASON,
  getPlatformAdminClient,
} from "./platform-admin-client";

/**
 * P1-N-045: Run a function within a Prisma transaction.
 * Ensures atomicity for tenant provisioning operations.
 */
export async function runProvisionTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const prisma = getPlatformAdminClient(PLATFORM_ADMIN_REASON.PLATFORM_PROVISION);
  return prisma.$transaction(fn);
}
