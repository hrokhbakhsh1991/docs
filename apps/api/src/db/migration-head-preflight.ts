import { PrismaClient } from "@prisma/client";

/** Must match latest prisma/migrations folder name (DEC-097 / MR-P0-003). */
export const EXPECTED_PRISMA_MIGRATION_HEAD =
  "20260802150000_urban_registrations_app_tour_grants";

/** Required intermediate migrations that must exist even if tip row is present. */
export const REQUIRED_PRISMA_MIGRATION_NAMES = [
  "20260720150000_operator_registration_active_guest_uniques",
  "20260720160000_hostile_audit_tenant_rls_closure",
  "20260720170000_operator_registration_active_guest_phone_unique",
  "20260721100000_portal_member_plans_bp7",
  EXPECTED_PRISMA_MIGRATION_HEAD,
] as const;

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
 * Production boot: DB migration head must match embedded app revision (MD-GAP-12),
 * and required intermediate migration names must be present (hostile audit P2).
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

    const requiredRows = await probe.$queryRaw<MigrationHeadRow[]>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
    `;
    const present = new Set(requiredRows.map((row) => row.migration_name));
    for (const name of REQUIRED_PRISMA_MIGRATION_NAMES) {
      if (!present.has(name)) {
        throw new Error(formatMigrationHeadMismatch(name, "missing_required"));
      }
    }
  } finally {
    await probe.$disconnect();
  }
}
