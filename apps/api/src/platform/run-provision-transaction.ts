import type { Prisma } from "@prisma/client";
import { getPrismaAdmin } from "../db/prisma";

/**
 * P1-N-045: Run a function within a Prisma transaction.
 * Ensures atomicity for tenant provisioning operations.
 */
export async function runProvisionTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const prisma = getPrismaAdmin();
  return prisma.$transaction(fn);
}

// Made with Bob
