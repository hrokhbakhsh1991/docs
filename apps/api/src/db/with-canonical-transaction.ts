import type { Prisma, PrismaClient } from "@prisma/client";

import { consumePreTransactionValidationGate } from "../canonical/pre-transaction-validation";
import { getActiveTraceId } from "../observability/trace-request-context";
import { withPoolSaturationMapping } from "./pool-saturation";
import { withTenantDbBudget } from "./tenant-connection-budget";
import { withTransientTxRetry } from "./with-transient-tx-retry";
import { getPrisma } from "./prisma";
import { resolvePrismaTransactionOptions } from "./prisma-transaction-options";
import { assertActiveTenantMatchesRlsTarget } from "./assert-tenant-rls-alignment";
import { applyCanonicalTransactionSession } from "./rls-session-vars";

/**
 * Phase 5 transaction boundary — sets RLS session tenant then runs fn in one Prisma TX.
 * @see docs/phase-5-canonical-schema.md §7
 */
export async function withCanonicalTransaction<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient, txNow: Date) => Promise<T>
): Promise<T> {
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    throw new Error("CANONICAL_TX_TENANT_REQUIRED");
  }
  assertActiveTenantMatchesRlsTarget(normalized);
  consumePreTransactionValidationGate(normalized);
  const prisma = getPrisma();
  return withTransientTxRetry(() =>
    withTenantDbBudget(normalized, () =>
      withPoolSaturationMapping(() =>
        prisma.$transaction(
          async (tx) => {
            const txNow = await applyCanonicalTransactionSession(
              tx,
              normalized,
              getActiveTraceId()
            );
            return fn(tx, txNow);
          },
          resolvePrismaTransactionOptions()
        )
      )
    )
  );
}

/**
 * Non-interactive canonical boundary for a Prisma batch transaction. The
 * callback is responsible for setting transaction-local RLS state before writes.
 */
export async function withCanonicalStatement<T>(
  tenantId: string,
  fn: (prisma: PrismaClient, normalizedTenantId: string, traceId: string | undefined) => Promise<T>
): Promise<T> {
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    throw new Error("CANONICAL_TX_TENANT_REQUIRED");
  }
  assertActiveTenantMatchesRlsTarget(normalized);
  consumePreTransactionValidationGate(normalized);
  const prisma = getPrisma();
  return withTransientTxRetry(() =>
    withTenantDbBudget(normalized, () =>
      withPoolSaturationMapping(() => fn(prisma, normalized, getActiveTraceId()))
    )
  );
}
