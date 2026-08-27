import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

/** Must match latest prisma/migrations folder name (DEC-097 / MR-P0-003). */
export const EXPECTED_PRISMA_MIGRATION_HEAD = "20260826120000_workspace_tour_theme_icon_key";

/** Required intermediate migrations that must exist even if tip row is present. */
export const REQUIRED_PRISMA_MIGRATION_NAMES = [
  "20260720150000_operator_registration_active_guest_uniques",
  "20260720160000_hostile_audit_tenant_rls_closure",
  "20260720170000_operator_registration_active_guest_phone_unique",
  "20260721100000_portal_member_plans_bp7",
  "20260803120000_http_idempotency_app_tour_grants",
  "20260807120000_operator_registration_departure_keyset_index",
  "20260809120000_finance_refunds",
  "20260821100000_operator_user_role_audit_app_tour_grants",
  EXPECTED_PRISMA_MIGRATION_HEAD,
] as const;

export const PRODUCTION_MIGRATION_HEAD_MISMATCH = "PRODUCTION_MIGRATION_HEAD_MISMATCH";
export const PRODUCTION_MIGRATION_CHECKSUM_MISMATCH =
  "PRODUCTION_MIGRATION_CHECKSUM_MISMATCH";

export type MigrationHeadRow = {
  readonly migration_name: string;
};

export type MigrationChecksumRow = MigrationHeadRow & {
  readonly checksum: string;
};

export type MigrationFileChecksum = {
  readonly migration_name: string;
  readonly checksum: string;
};

function resolveDefaultMigrationsDir(): string {
  return (
    process.env.PRISMA_MIGRATIONS_DIR?.trim() ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../prisma/migrations")
  );
}

export function readLocalMigrationChecksums(
  migrationsDir = resolveDefaultMigrationsDir()
): readonly MigrationFileChecksum[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const migration_name = entry.name;
      const migrationSql = readFileSync(path.join(migrationsDir, migration_name, "migration.sql"));
      return {
        migration_name,
        checksum: createHash("sha256").update(migrationSql).digest("hex"),
      };
    })
    .sort((a, b) => a.migration_name.localeCompare(b.migration_name));
}

export function formatMigrationHeadMismatch(expected: string, actual: string | undefined): string {
  return `${PRODUCTION_MIGRATION_HEAD_MISMATCH}:${expected}:${actual ?? "none"}`;
}

export function formatMigrationChecksumMismatch(
  migrationName: string,
  expected: string | undefined,
  actual: string | undefined
): string {
  return `${PRODUCTION_MIGRATION_CHECKSUM_MISMATCH}:${migrationName}:${expected ?? "missing_local"}:${actual ?? "missing_db"}`;
}

export function assertMigrationHeadMatches(
  actual: string | undefined,
  expected = EXPECTED_PRISMA_MIGRATION_HEAD
): void {
  if (actual !== expected) {
    throw new Error(formatMigrationHeadMismatch(expected, actual));
  }
}

export function assertMigrationChecksumsMatch(
  appliedRows: readonly MigrationChecksumRow[],
  localRows: readonly MigrationFileChecksum[]
): void {
  const applied = new Map(appliedRows.map((row) => [row.migration_name, row.checksum]));
  const local = new Map(localRows.map((row) => [row.migration_name, row.checksum]));

  for (const row of localRows) {
    const actual = applied.get(row.migration_name);
    if (actual !== row.checksum) {
      throw new Error(formatMigrationChecksumMismatch(row.migration_name, row.checksum, actual));
    }
  }

  for (const row of appliedRows) {
    if (!local.has(row.migration_name)) {
      throw new Error(formatMigrationChecksumMismatch(row.migration_name, undefined, row.checksum));
    }
  }
}

/**
 * Production boot: DB migration head must match embedded app revision (MD-GAP-12),
 * and required intermediate migration names must be present (hostile audit P2).
 */
export async function assertProductionMigrationHead(
  databaseUrl: string,
  migrationsDir?: string
): Promise<void> {
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

    const requiredRows = await probe.$queryRaw<MigrationChecksumRow[]>`
      SELECT migration_name, checksum
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
    `;
    const present = new Set(requiredRows.map((row) => row.migration_name));
    for (const name of REQUIRED_PRISMA_MIGRATION_NAMES) {
      if (!present.has(name)) {
        throw new Error(formatMigrationHeadMismatch(name, "missing_required"));
      }
    }

    assertMigrationChecksumsMatch(requiredRows, readLocalMigrationChecksums(migrationsDir));
  } finally {
    await probe.$disconnect();
  }
}
