import type { Prisma } from "@prisma/client";

/**
 * Sets transaction-local RLS + trace GUCs in one round-trip (PERF-2 / Phase 0 roadmap).
 */
export async function applyTenantRlsSessionVars(
  tx: Prisma.TransactionClient,
  tenantId: string,
  traceId: string | undefined
): Promise<void> {
  if (traceId !== undefined && traceId.length > 0) {
    await tx.$executeRaw`
      SELECT
        set_config('app.current_tenant_id', ${tenantId}::text, true),
        set_config('app.current_trace_id', ${traceId}::text, true)
    `;
    return;
  }
  await tx.$executeRaw`
    SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)
  `;
}
