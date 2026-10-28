import type { SecondStagingRunFixtureIds } from "./denali-second-staging-run-fixtures";

export type SecondStagingFixtureManifest = Readonly<{
  manifestVersion: 1;
  source: "denali-second-staging-fixtures";
  tenantId: string;
  runId: string;
  identityIds: SecondStagingRunFixtureIds["identities"];
  resources: SecondStagingRunFixtureIds["resources"];
  tours: SecondStagingRunFixtureIds["tours"];
  registrations: SecondStagingRunFixtureIds["registrations"];
}>;

export type SecondStagingFinancialDependencyCounts = Readonly<{
  payments: number;
  refunds: number;
  reconciliationFindings: number;
  schedules: number;
  commercialQuotes: number;
  paymentHolds: number;
}>;

/** Include every planned registration ID so orphaned financial rows are still detected. */
export function getSecondStagingCleanupRegistrationIds(
  registrations: SecondStagingRunFixtureIds["registrations"]
): readonly string[] {
  return [registrations.free, registrations.paid];
}

/** Refuse fixture deletion while any financial history still points at its registrations. */
export function assertNoSecondStagingFinancialDependencies(
  counts: SecondStagingFinancialDependencyCounts
): void {
  if (Object.values(counts).some((count) => count > 0)) {
    throw new Error("DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validates a saved seed manifest against IDs deterministically derived for this tenant/run. */
export function assertSecondStagingFixtureManifest(
  value: unknown,
  expected: SecondStagingRunFixtureIds
): asserts value is SecondStagingFixtureManifest {
  if (
    !record(value) ||
    value.manifestVersion !== 1 ||
    value.source !== "denali-second-staging-fixtures" ||
    value.tenantId !== expected.tenantId ||
    value.runId !== expected.runId
  ) {
    throw new Error("DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED");
  }
  for (const [manifestKey, expectedKey] of [
    ["identityIds", "identities"],
    ["resources", "resources"],
    ["tours", "tours"],
    ["registrations", "registrations"],
  ] as const) {
    const candidate = value[manifestKey];
    const expectedGroup = expected[expectedKey];
    if (
      !record(candidate) ||
      Object.entries(expectedGroup).some(
        ([field, expectedValue]) => candidate[field] !== expectedValue
      ) ||
      Object.keys(candidate).some(
        (field) => !Object.prototype.hasOwnProperty.call(expectedGroup, field)
      )
    ) {
      throw new Error("DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED");
    }
  }
}
