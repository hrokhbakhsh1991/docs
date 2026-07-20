import type { TenantRouteRow, TenantTier } from "@app-cloud/tenant-kernel";
import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { isPersistedTenantUuid } from "./tenant-id-format";

function isTenantTier(value: string): value is TenantTier {
  return value === "pool" || value === "silo";
}

const rowCache = new Map<string, TenantRouteRow | null>();
const inflight = new Map<string, Promise<TenantRouteRow | null>>();
let tenantRoutesTableMissing = false;

/** Test-only: clears lookup cache between specs. */
export function resetTenantRouteLookupCacheForTests(): void {
  rowCache.clear();
  inflight.clear();
  tenantRoutesTableMissing = false;
}

async function loadTenantRouteRow(normalized: string): Promise<TenantRouteRow | null> {
  if (tenantRoutesTableMissing) {
    return null;
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    return null;
  }
  let row: {
    tier: string;
    databaseUrl: string | null;
    schemaName: string | null;
  } | null;
  try {
    // tenant_routes is FORCE RLS — must set GUC (TODO-002).
    row = await withTenantRls(normalized, (tx) =>
      tx.tenantRoute.findUnique({
        where: { tenantId: normalized },
        select: {
          tier: true,
          databaseUrl: true,
          schemaName: true,
        },
      })
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      tenantRoutesTableMissing = true;
      return null;
    }
    throw error;
  }
  if (row === null) {
    return null;
  }
  if (!isTenantTier(row.tier)) {
    throw new Error("TENANT_ROUTE_INVALID_TIER");
  }
  return {
    tier: row.tier,
    databaseUrl: row.databaseUrl,
    schemaName: row.schemaName,
  };
}

/**
 * Loads tenant_routes row for {@link TenantConnectionRouter} (Phase 7.7).
 * Per-tenant cache + singleflight avoids N Prisma round-trips per HTTP burst.
 */
export async function lookupTenantRouteRow(tenantId: string): Promise<TenantRouteRow | null> {
  const normalized = tenantId.trim();
  if (normalized.length === 0 || !isPersistedTenantUuid(normalized)) {
    return null;
  }
  if (tenantRoutesTableMissing) {
    return null;
  }
  if (rowCache.has(normalized)) {
    return rowCache.get(normalized) ?? null;
  }
  let pending = inflight.get(normalized);
  if (pending === undefined) {
    pending = loadTenantRouteRow(normalized).finally(() => {
      inflight.delete(normalized);
    });
    inflight.set(normalized, pending);
  }
  const resolved = await pending;
  rowCache.set(normalized, resolved);
  return resolved;
}
