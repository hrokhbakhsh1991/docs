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
const TOUR_CREATE_TIMESTAMP_DRIFT_MS = 90 * 60_000;

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

/** Bound title recovery around the exact run, allowing for staging/runner timezone drift. */
export function getSecondStagingWizardTourCreatedAtWindow(testStartedAt: string): {
  gte: Date;
  lte: Date;
} {
  const timestamp = Date.parse(testStartedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== testStartedAt) {
    throw new Error("DENALI_SECOND_STAGING_WIZARD_CLEANUP_MANIFEST_REJECTED");
  }
  return {
    gte: new Date(timestamp - TOUR_CREATE_TIMESTAMP_DRIFT_MS),
    lte: new Date(timestamp + TOUR_CREATE_TIMESTAMP_DRIFT_MS),
  };
}

/** Prefer the exact row ID; use a bounded timestamp when creation was not recorded. */
export function buildSecondStagingWizardTourMatchWhere(
  manifest: SecondStagingWizardTourManifest
): Readonly<{
  tenantId: string;
  title: string;
  id?: string;
  createdAt?: { gte: Date; lte: Date };
}> {
  const scope = { tenantId: manifest.tenantId, title: manifest.title };
  if (manifest.tourId !== null) {
    return { ...scope, id: manifest.tourId };
  }
  return {
    ...scope,
    createdAt: getSecondStagingWizardTourCreatedAtWindow(manifest.testStartedAt),
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
