import {
  SECOND_STAGING_IDENTITY_IDS,
  SECOND_STAGING_TENANT,
} from "./denali-second-staging-fixtures";

export type SecondStagingWizardTourManifest = Readonly<{
  manifestVersion: 1;
  source: "denali-second-staging-wizard-e10";
  runId: string;
  tenantId: string;
  ownerUserId: string;
  runtimeSha: string;
  testSha: string;
  title: string;
  testStartedAt: string;
  tourId: string | null;
  status: "draft" | "active";
}>;

export type SecondStagingWizardTourDependencies = Readonly<{
  operatorRegistrations: number;
  urbanRegistrations: number;
  transportAllocations: number;
  rosterFreezes: number;
  reminderActivations: number;
}>;

const MANIFEST_KEYS = [
  "manifestVersion",
  "source",
  "runId",
  "tenantId",
  "ownerUserId",
  "runtimeSha",
  "testSha",
  "title",
  "testStartedAt",
  "tourId",
  "status",
].sort();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/i;
const EARLIEST_TOUR_CLOCK_SKEW_MS = 5 * 60_000;
const LATEST_TOUR_CREATE_DELAY_MS = 10 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Accept only the exact run-scoped artifact written by the S2-E10 browser test. */
export function assertSecondStagingWizardTourManifest(
  value: unknown
): asserts value is SecondStagingWizardTourManifest {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join("\n") !== MANIFEST_KEYS.join("\n") ||
    value.manifestVersion !== 1 ||
    value.source !== "denali-second-staging-wizard-e10" ||
    value.tenantId !== SECOND_STAGING_TENANT.id ||
    value.ownerUserId !== SECOND_STAGING_IDENTITY_IDS.owner ||
    typeof value.runId !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value.runId) ||
    value.title !== `S2-E10 ${value.runId}` ||
    typeof value.runtimeSha !== "string" ||
    !SHA.test(value.runtimeSha) ||
    typeof value.testSha !== "string" ||
    !SHA.test(value.testSha) ||
    typeof value.testStartedAt !== "string" ||
    !Number.isFinite(Date.parse(value.testStartedAt)) ||
    new Date(Date.parse(value.testStartedAt)).toISOString() !== value.testStartedAt ||
    (value.tourId !== null && (typeof value.tourId !== "string" || !UUID.test(value.tourId))) ||
    (value.status !== "draft" && value.status !== "active")
  ) {
    throw new Error("DENALI_SECOND_STAGING_WIZARD_CLEANUP_MANIFEST_REJECTED");
  }
}

/** Bound title recovery to the exact run window so an old manifest cannot match a later replay. */
export function getSecondStagingWizardTourCreatedAtWindow(testStartedAt: string): {
  gte: Date;
  lte: Date;
} {
  const timestamp = Date.parse(testStartedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== testStartedAt) {
    throw new Error("DENALI_SECOND_STAGING_WIZARD_CLEANUP_MANIFEST_REJECTED");
  }
  return {
    gte: new Date(timestamp - EARLIEST_TOUR_CLOCK_SKEW_MS),
    lte: new Date(timestamp + LATEST_TOUR_CREATE_DELAY_MS),
  };
}

/** Refuse tour deletion when a task-owned tour has acquired any business history. */
export function assertNoSecondStagingWizardTourDependencies(
  counts: SecondStagingWizardTourDependencies
): void {
  if (Object.values(counts).some((count) => count !== 0)) {
    throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");
  }
}
