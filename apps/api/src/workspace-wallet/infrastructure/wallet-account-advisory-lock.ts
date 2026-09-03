/**
 * WALLET-P2C — advisory lock for balance-affecting wallet mutations.
 */
import type { Prisma } from "@prisma/client";

export function walletAccountAdvisoryLockKey(
  tenantId: string,
  accountId: string,
): string {
  return `wallet:${tenantId}:${accountId}`;
}

export async function advisoryLockWalletAccount(
  tx: Prisma.TransactionClient,
  tenantId: string,
  accountId: string,
): Promise<void> {
  const key = walletAccountAdvisoryLockKey(tenantId, accountId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
