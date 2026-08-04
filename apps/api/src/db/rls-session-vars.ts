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

/** Sets transaction-local RLS/trace state and reads the DB clock in one round-trip. */
export async function applyCanonicalTransactionSession(
  tx: Prisma.TransactionClient,
  tenantId: string,
  traceId: string | undefined
): Promise<Date> {
  const rows =
    traceId !== undefined && traceId.length > 0
      ? await tx.$queryRaw<Array<{ ts: Date }>>`
          SELECT
            set_config('app.current_tenant_id', ${tenantId}::text, true),
            set_config('app.current_trace_id', ${traceId}::text, true),
            now() AS ts
        `
      : await tx.$queryRaw<Array<{ ts: Date }>>`
          SELECT
            set_config('app.current_tenant_id', ${tenantId}::text, true),
            now() AS ts
        `;
  const ts = rows[0]?.ts;
  if (!(ts instanceof Date) || Number.isNaN(ts.getTime())) {
    throw new Error("CANONICAL_TX_NOW_INVALID");
  }
  return ts;
}
