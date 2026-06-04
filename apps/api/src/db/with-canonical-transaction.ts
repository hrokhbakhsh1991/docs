import type { Prisma } from "@prisma/client";

import { getPrisma } from "./prisma";

/**
 * Phase 5 transaction boundary — sets RLS session tenant then runs fn in one Prisma TX.
 * @see docs/phase-5-canonical-schema.md §7
 */
export async function withCanonicalTransaction<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!tenantId?.trim()) {
    throw new Error("CANONICAL_TX_TENANT_REQUIRED");
  }
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)
    `;
    return fn(tx);
  });
}
