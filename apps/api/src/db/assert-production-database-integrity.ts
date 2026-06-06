import { PrismaClient } from "@prisma/client";

import { assertProductionMigrationHead } from "./migration-head-preflight";
import { resolveStorageDriver } from "../storage/create-tour-storage";
import { isProductionAuthMode } from "../tenant-kernel/auth-env";

export const PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS = "PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS";
export const PRODUCTION_DATABASE_RLS_NOT_APPLIED = "PRODUCTION_DATABASE_RLS_NOT_APPLIED";

/** Tenant-scoped tables that must have RLS enabled before production ingress (DEC-024). */
export const TENANT_RLS_TABLES = [
  "tours",
  "outbox_events",
  "audit_events",
  "http_idempotency_records",
  "processed_domain_events",
] as const;

export type TenantRlsTableRow = {
  readonly relname: string;
  readonly relrowsecurity: boolean;
  readonly relforcerowsecurity: boolean;
};

export function assertAppRoleDoesNotBypassRls(rolbypassrls: boolean | undefined): void {
  if (rolbypassrls === true) {
    throw new Error(PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS);
  }
}

export function assertTenantTablesHaveRls(rows: readonly TenantRlsTableRow[]): void {
  const byName = new Map(rows.map((row) => [row.relname, row]));
  for (const table of TENANT_RLS_TABLES) {
    const row = byName.get(table);
    if (row === undefined || !row.relrowsecurity || !row.relforcerowsecurity) {
      throw new Error(`${PRODUCTION_DATABASE_RLS_NOT_APPLIED}:${table}`);
    }
  }
}

/**
 * Live Postgres probe at production boot (DM-CT-02 / DI-PRISMA-01).
 * Verifies the app pool role does not bypass RLS and migrations applied RLS on tenant tables.
 * @see docs/phase-4/appendices/storage-driver-truth.md
 */
export async function assertProductionDatabaseIntegrity(): Promise<void> {
  if (!isProductionAuthMode()) {
    return;
  }
  if (resolveStorageDriver() !== "prisma") {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return;
  }

  const probe = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const roleRows = await probe.$queryRaw<Array<{ rolbypassrls: boolean }>>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    assertAppRoleDoesNotBypassRls(roleRows[0]?.rolbypassrls);

    const rlsRows = await probe.$queryRaw<TenantRlsTableRow[]>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'tours',
          'outbox_events',
          'audit_events',
          'http_idempotency_records',
          'processed_domain_events'
        )
    `;
    assertTenantTablesHaveRls(rlsRows);
    await assertProductionMigrationHead(databaseUrl);
  } finally {
    await probe.$disconnect();
  }
}
