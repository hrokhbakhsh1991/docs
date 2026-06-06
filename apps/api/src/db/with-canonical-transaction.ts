import type { Prisma } from "@prisma/client";

import { consumePreTransactionValidationGate } from "../canonical/pre-transaction-validation";
import { getActiveTraceId } from "../observability/trace-request-context";
import { withPoolSaturationMapping } from "./pool-saturation";
import { getPrisma } from "./prisma";
import { assertActiveTenantMatchesRlsTarget } from "./assert-tenant-rls-alignment";
import { applyTenantRlsSessionVars } from "./rls-session-vars";

/**
 * Phase 5 transaction boundary — sets RLS session tenant then runs fn in one Prisma TX.
 * @see docs/phase-5-canonical-schema.md §7
 */
export async function withCanonicalTransaction<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    throw new Error("CANONICAL_TX_TENANT_REQUIRED");
  }
  assertActiveTenantMatchesRlsTarget(normalized);
  consumePreTransactionValidationGate(normalized);
  const prisma = getPrisma();
  return withPoolSaturationMapping(() =>
    prisma.$transaction(async (tx) => {
      await applyTenantRlsSessionVars(tx, normalized, getActiveTraceId());
      return fn(tx);
    })
  );
}
