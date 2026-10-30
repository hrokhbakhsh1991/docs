import assert from "node:assert/strict";
import test from "node:test";
import { buildSecondStagingRunFixtureIds } from "../scripts/lib/denali-second-staging-run-fixtures";
import {
  assertNoSecondStagingFinancialDependencies,
  assertSecondStagingFixtureManifest,
  getSecondStagingCleanupRegistrationIds,
} from "../scripts/lib/denali-second-staging-cleanup";
import {
  LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS,
  resolveSecondStagingCleanupIdentityIds,
  SECOND_STAGING_IDENTITY_IDS,
  SECOND_STAGING_TENANT,
} from "../scripts/lib/denali-second-staging-fixtures";

const fixtureInput = (runId: string) => ({
  tenantId: SECOND_STAGING_TENANT.id,
  runId,
  identityUserIds: SECOND_STAGING_IDENTITY_IDS,
});

test("second staging run fixtures are deterministic and run-scoped", () => {
  const first = buildSecondStagingRunFixtureIds(fixtureInput("run-20261029-a"));
  const repeat = buildSecondStagingRunFixtureIds(fixtureInput("run-20261029-a"));
  const second = buildSecondStagingRunFixtureIds(fixtureInput("run-20261029-b"));
  const firstIds = [
    ...Object.values(first.resources),
    ...Object.values(first.tours),
    ...Object.values(first.registrations),
  ];
  const secondIds = [
    ...Object.values(second.resources),
    ...Object.values(second.tours),
    ...Object.values(second.registrations),
  ];

  assert.deepEqual(repeat, first);
  assert.equal(new Set(firstIds).size, firstIds.length);
  assert.equal(new Set(secondIds).size, secondIds.length);
  assert.equal(
    firstIds.some((id) => secondIds.includes(id)),
    false
  );
  assert.ok(firstIds.every((id) => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id)));
  assert.ok(firstIds.every((id) => id[14] === "5" && /^[89ab]$/.test(id[19]!)));
});

test("second staging run fixture factory rejects tenant A and unknown tenants", () => {
  assert.throws(
    () =>
      buildSecondStagingRunFixtureIds({
        ...fixtureInput("run-20261029-a"),
        tenantId: "00000000-0000-4000-8000-000000000001",
      }),
    /DENALI_SECOND_STAGING_FIXTURE_TENANT_REJECTED/
  );
});

test("second staging run fixture factory rejects unsafe or ambiguous run IDs", () => {
  for (const runId of ["", ".hidden", "../escape-2026", "a".repeat(65)]) {
    assert.throws(
      () => buildSecondStagingRunFixtureIds(fixtureInput(runId)),
      /DENALI_SECOND_STAGING_FIXTURE_RUN_ID_INVALID/
    );
  }
});

test("second staging run fixture factory rejects duplicate or malformed identities", () => {
  assert.throws(
    () =>
      buildSecondStagingRunFixtureIds({
        ...fixtureInput("run-20261029-a"),
        identityUserIds: {
          owner: "c51ad260-53cd-49c9-8d43-72fbc0129001",
          finance: "c51ad260-53cd-49c9-8d43-72fbc0129001",
          member: "not-a-uuid",
        },
      }),
    /DENALI_SECOND_STAGING_FIXTURE_IDENTITIES_INVALID/
  );
});

test("cleanup accepts only a seed manifest that exactly matches deterministic tenant/run IDs", () => {
  const ids = buildSecondStagingRunFixtureIds(fixtureInput("run-20261029-a"));
  const manifest = {
    manifestVersion: 1,
    source: "denali-second-staging-fixtures",
    tenantId: ids.tenantId,
    runId: ids.runId,
    identityIds: ids.identities,
    resources: ids.resources,
    tours: ids.tours,
    registrations: ids.registrations,
  };
  assert.doesNotThrow(() => assertSecondStagingFixtureManifest(manifest, ids));
  assert.throws(
    () => assertSecondStagingFixtureManifest({ ...manifest, tenantId: "other-tenant" }, ids),
    /DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED/
  );
  assert.throws(
    () =>
      assertSecondStagingFixtureManifest(
        { ...manifest, resources: { ...ids.resources, theme: "other" } },
        ids
      ),
    /DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED/
  );
  assert.throws(
    () =>
      assertSecondStagingFixtureManifest(
        { ...manifest, registrations: { ...ids.registrations, unrelated: "x" } },
        ids
      ),
    /DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED/
  );
  const legacyIds = buildSecondStagingRunFixtureIds({
    ...fixtureInput("run-20261029-legacy"),
    identityUserIds: LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS,
  });
  assert.doesNotThrow(() =>
    assertSecondStagingFixtureManifest(
      {
        manifestVersion: 1,
        source: "denali-second-staging-fixtures",
        tenantId: legacyIds.tenantId,
        runId: legacyIds.runId,
        identityIds: legacyIds.identities,
        resources: legacyIds.resources,
        tours: legacyIds.tours,
        registrations: legacyIds.registrations,
      },
      legacyIds
    )
  );
});

test("cleanup manifest identity binding accepts only current or historical fixture IDs", () => {
  assert.deepEqual(resolveSecondStagingCleanupIdentityIds(SECOND_STAGING_IDENTITY_IDS), {
    owner: SECOND_STAGING_IDENTITY_IDS.owner,
    finance: SECOND_STAGING_IDENTITY_IDS.finance,
    member: SECOND_STAGING_IDENTITY_IDS.member,
  });
  assert.deepEqual(
    resolveSecondStagingCleanupIdentityIds(LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS),
    LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS
  );
  assert.throws(
    () =>
      resolveSecondStagingCleanupIdentityIds({
        ...LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS,
        finance: SECOND_STAGING_IDENTITY_IDS.finance,
      }),
    /DENALI_SECOND_STAGING_CLEANUP_MANIFEST_REJECTED/
  );
});

test("cleanup refuses to delete registrations with any financial history", () => {
  const empty = {
    payments: 0,
    refunds: 0,
    reconciliationFindings: 0,
    schedules: 0,
    commercialQuotes: 0,
    paymentHolds: 0,
  };
  assert.doesNotThrow(() => assertNoSecondStagingFinancialDependencies(empty));
  for (const key of Object.keys(empty) as (keyof typeof empty)[]) {
    assert.throws(
      () => assertNoSecondStagingFinancialDependencies({ ...empty, [key]: 1 }),
      /DENALI_SECOND_STAGING_CLEANUP_DEPENDENCY_FOUND/
    );
  }
});

test("cleanup checks expected registration IDs even if their registration rows are missing", () => {
  const ids = buildSecondStagingRunFixtureIds(fixtureInput("run-20261029-a"));

  assert.deepEqual(getSecondStagingCleanupRegistrationIds(ids.registrations), [
    ids.registrations.free,
    ids.registrations.paid,
  ]);
});
