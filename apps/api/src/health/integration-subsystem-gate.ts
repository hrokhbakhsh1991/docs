import type { MigrationConsistencyReport } from "./migration-consistency-check";
import {
  logExposureTablesConsistencyWarn,
  logMigrationConsistencyReport,
} from "./migration-consistency-check";

let integrationSubsystemReady = false;
let lastReport: MigrationConsistencyReport | null = null;

export function isIntegrationSubsystemReady(): boolean {
  return integrationSubsystemReady;
}

export function getLastMigrationConsistencyReport(): MigrationConsistencyReport | null {
  return lastReport;
}

/** Arms or blocks the integration subsystem from the latest consistency report. */
export function applyMigrationConsistencyGate(report: MigrationConsistencyReport): void {
  lastReport = report;
  if (report.missingExposureTables.length > 0 && report.ok) {
    logExposureTablesConsistencyWarn(report.missingExposureTables, report.checkedAt);
  }
  integrationSubsystemReady = report.ok;
  logMigrationConsistencyReport(report);
}

export function blockIntegrationSubsystem(): void {
  integrationSubsystemReady = false;
}

/** Test-only */
export function resetIntegrationSubsystemGateForTests(): void {
  integrationSubsystemReady = false;
  lastReport = null;
}

/** Test-only — bypass gate when Prisma integration tables are mocked. */
export function forceIntegrationSubsystemReadyForTests(report?: MigrationConsistencyReport): void {
  integrationSubsystemReady = true;
  lastReport =
    report ??
    ({
      ok: true,
      signal: "CONSISTENCY_OK",
      service: "@apps/api",
      missingTables: [],
      missingExposureTables: [],
      unappliedMigrations: [],
      expectedMigrationCount: 0,
      appliedMigrationCount: 0,
      tourPublishedPolicyDriftCount: 0,
      checkedAt: new Date().toISOString(),
    } satisfies MigrationConsistencyReport);
}
