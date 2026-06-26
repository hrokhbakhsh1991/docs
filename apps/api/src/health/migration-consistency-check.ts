import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { getPrisma } from "../db/prisma";
import { logger } from "../observability/logger";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert";

/** Integration subsystem tables that must exist before arming delivery/control plane. */
export const REQUIRED_INTEGRATION_TABLES = [
  "integration_connections",
  "integration_delivery_jobs",
  "integration_event_policies",
  "integration_secrets",
  "workspace_telegram_bots",
] as const;

export type ConsistencySignal =
  | "CONSISTENCY_OK"
  | "CONSISTENCY_MISSING_TABLES"
  | "CONSISTENCY_MIGRATION_DRIFT";

export type MigrationConsistencyReport = {
  readonly ok: boolean;
  readonly signal: ConsistencySignal;
  readonly service: "@apps/api";
  readonly missingTables: readonly string[];
  readonly unappliedMigrations: readonly string[];
  readonly expectedMigrationCount: number;
  readonly appliedMigrationCount: number;
  readonly checkedAt: string;
};

function resolveMigrationsDirectory(): string {
  const fromCwd = join(process.cwd(), "prisma", "migrations");
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromMonorepo = join(process.cwd(), "apps", "api", "prisma", "migrations");
  if (existsSync(fromMonorepo)) {
    return fromMonorepo;
  }
  return fromCwd;
}

export function listExpectedMigrationNamesFromDisk(): string[] {
  const migrationsDir = resolveMigrationsDirectory();
  if (!existsSync(migrationsDir)) {
    return [];
  }

  return readdirSync(migrationsDir)
    .filter((name) => {
      if (name === "migration_lock.toml") {
        return false;
      }
      const entryPath = join(migrationsDir, name);
      try {
        return statSync(entryPath).isDirectory() && existsSync(join(entryPath, "migration.sql"));
      } catch {
        return false;
      }
    })
    .sort();
}

export function computeUnappliedMigrations(
  expected: readonly string[],
  applied: ReadonlySet<string>
): string[] {
  return expected.filter((name) => !applied.has(name));
}

export function buildMigrationConsistencyReport(input: {
  readonly missingTables: readonly string[];
  readonly unappliedMigrations: readonly string[];
  readonly expectedMigrationCount: number;
  readonly appliedMigrationCount: number;
  readonly checkedAt?: string;
}): MigrationConsistencyReport {
  const signal: ConsistencySignal =
    input.missingTables.length > 0
      ? "CONSISTENCY_MISSING_TABLES"
      : input.unappliedMigrations.length > 0
        ? "CONSISTENCY_MIGRATION_DRIFT"
        : "CONSISTENCY_OK";

  return {
    ok: signal === "CONSISTENCY_OK",
    signal,
    service: "@apps/api",
    missingTables: input.missingTables,
    unappliedMigrations: input.unappliedMigrations,
    expectedMigrationCount: input.expectedMigrationCount,
    appliedMigrationCount: input.appliedMigrationCount,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}

async function listAppliedMigrationNames(): Promise<string[]> {
  const rows = await getPrisma().$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  `;
  return rows.map((row) => row.migration_name);
}

async function findMissingIntegrationTables(): Promise<string[]> {
  const rows = await getPrisma().$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'integration_connections',
        'integration_delivery_jobs',
        'integration_event_policies',
        'integration_secrets',
        'workspace_telegram_bots'
      )
  `;
  const present = new Set(rows.map((row) => row.table_name));
  return REQUIRED_INTEGRATION_TABLES.filter((table) => !present.has(table));
}

export function shouldRunMigrationConsistencyCheck(): boolean {
  return resolveStorageDriver() === "prisma" && (process.env.DATABASE_URL?.trim().length ?? 0) > 0;
}

/**
 * Compares Prisma migration expectations vs live Postgres schema.
 * Safe to call from boot and from GET /internal/consistency/migrations.
 */
export async function runMigrationConsistencyCheck(): Promise<MigrationConsistencyReport> {
  if (!shouldRunMigrationConsistencyCheck()) {
    return buildMigrationConsistencyReport({
      missingTables: [],
      unappliedMigrations: [],
      expectedMigrationCount: 0,
      appliedMigrationCount: 0,
    });
  }

  const [missingTables, appliedNames] = await Promise.all([
    findMissingIntegrationTables(),
    listAppliedMigrationNames(),
  ]);
  const expectedNames = listExpectedMigrationNamesFromDisk();
  const appliedSet = new Set(appliedNames);
  const unappliedMigrations = computeUnappliedMigrations(expectedNames, appliedSet);

  return buildMigrationConsistencyReport({
    missingTables,
    unappliedMigrations,
    expectedMigrationCount: expectedNames.length,
    appliedMigrationCount: appliedNames.length,
  });
}

export function logMigrationConsistencyReport(report: MigrationConsistencyReport): void {
  const payload = {
    event: "consistency.check",
    signal: report.signal,
    service: report.service,
    missingTables: report.missingTables,
    unappliedMigrations: report.unappliedMigrations,
    checkedAt: report.checkedAt,
  };

  if (report.ok) {
    logger.info(payload, "CONSISTENCY_OK");
    return;
  }

  logger.error(payload, report.signal);
}
