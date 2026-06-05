import type { Prisma } from "@prisma/client";

import { applyTestDbHoldIfConfigured, withPoolSaturationMapping } from "./pool-saturation";
import { getPrisma } from "./prisma";
import { assertActiveTenantMatchesRlsTarget } from "./assert-tenant-rls-alignment";
import { applyTenantRlsSessionVars } from "./rls-session-vars";
import { getActiveTraceId } from "../observability/trace-request-context";

/**
 * Runs Prisma work with Postgres RLS session variable set on the same connection.
 * Uses a transaction so set_config(..., true) and queries share one connection.
 */
export async function withTenantRls<T>(
  tenantId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    throw new Error("TENANT_RLS_TENANT_ID_REQUIRED");
  }
  assertActiveTenantMatchesRlsTarget(normalized);
  const prisma = getPrisma();
  return withPoolSaturationMapping(() =>
    prisma.$transaction(async (tx) => {
      await applyTenantRlsSessionVars(tx, normalized, getActiveTraceId());
      await applyTestDbHoldIfConfigured(tx);
      return run(tx);
    })
  );
}
