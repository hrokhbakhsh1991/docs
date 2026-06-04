import type { Prisma } from "@prisma/client";

import { getPrisma } from "./prisma";

/**
 * Runs Prisma work with Postgres RLS session variable set on the same connection.
 * Uses a transaction so set_config(..., true) and queries share one connection.
 */
export async function withTenantRls<T>(
  tenantId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)
    `;
    return run(tx);
  });
}
