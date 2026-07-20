import { PrismaClient } from "@prisma/client";

/** Must match latest prisma/migrations folder name (DEC-097 / MR-P0-003). */
export const EXPECTED_PRISMA_MIGRATION_HEAD = "20260720160000_hostile_audit_tenant_rls_closure";

export const PRODUCTION_MIGRATION_HEAD_MISMATCH = "PRODUCTION_MIGRATION_HEAD_MISMATCH";

export type MigrationHeadRow = {
  readonly migration_name: string;
};

export function formatMigrationHeadMismatch(expected: string, actual: string | undefined): string {
  return `${PRODUCTION_MIGRATION_HEAD_MISMATCH}:${expected}:${actual ?? "none"}`;
}

export function assertMigrationHeadMatches(
  actual: string | undefined,
  expected = EXPECTED_PRISMA_MIGRATION_HEAD
): void {
  if (actual !== expected) {
    throw new Error(formatMigrationHeadMismatch(expected, actual));
  }
}

/**
 * Production boot: DB migration head must match embedded app revision (MD-GAP-12).
 */
export async function assertProductionMigrationHead(databaseUrl: string): Promise<void> {
  const probe = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const rows = await probe.$queryRaw<MigrationHeadRow[]>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    assertMigrationHeadMatches(rows[0]?.migration_name);
  } finally {
    await probe.$disconnect();
  }
}
