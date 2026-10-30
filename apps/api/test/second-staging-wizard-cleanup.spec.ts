import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoSecondStagingWizardTourDependencies,
  getSecondStagingWizardTourCreatedAtWindow,
  assertSecondStagingWizardTourManifest,
} from "../scripts/lib/denali-second-staging-wizard-cleanup";
import {
  SECOND_STAGING_IDENTITY_IDS,
  SECOND_STAGING_TENANT,
} from "../scripts/lib/denali-second-staging-fixtures";

const validManifest = () => ({
  manifestVersion: 1,
  source: "denali-second-staging-wizard-e10",
  runId: "qa2-20261030-a1",
  tenantId: SECOND_STAGING_TENANT.id,
  ownerUserId: SECOND_STAGING_IDENTITY_IDS.owner,
  runtimeSha: "a".repeat(40),
  testSha: "b".repeat(40),
  title: "S2-E10 qa2-20261030-a1",
  testStartedAt: "2026-10-30T10:00:00.000Z",
  tourId: null,
  status: "draft",
});

test("second staging wizard cleanup accepts a pre-create manifest with no tour ID", () => {
  assert.doesNotThrow(() => assertSecondStagingWizardTourManifest(validManifest()));
});

test("second staging wizard cleanup accepts an exact post-create manifest", () => {
  assert.doesNotThrow(() =>
    assertSecondStagingWizardTourManifest({
      ...validManifest(),
      tourId: "36da3ea8-aa09-4063-9fa2-427ed4bb175c",
      status: "active",
    })
  );
});

test("second staging wizard cleanup rejects cross-tenant and mismatched-title manifests", () => {
  assert.throws(() =>
    assertSecondStagingWizardTourManifest({ ...validManifest(), tenantId: "other-tenant" })
  );
  assert.throws(() =>
    assertSecondStagingWizardTourManifest({ ...validManifest(), title: "unscoped title" })
  );
});

test("second staging wizard cleanup rejects malformed or unbound manifest fields", () => {
  assert.throws(() =>
    assertSecondStagingWizardTourManifest({ ...validManifest(), testSha: "dirty-checkout" })
  );
  assert.throws(() =>
    assertSecondStagingWizardTourManifest({ ...validManifest(), tourId: "not-a-uuid" })
  );
  assert.throws(() =>
    assertSecondStagingWizardTourManifest({ ...validManifest(), extra: "unreviewed" })
  );
});

test("second staging wizard cleanup refuses tours with linked business history", () => {
  assert.doesNotThrow(() =>
    assertNoSecondStagingWizardTourDependencies({
      operatorRegistrations: 0,
      urbanRegistrations: 0,
      transportAllocations: 0,
      rosterFreezes: 0,
      reminderActivations: 0,
    })
  );
  assert.throws(() =>
    assertNoSecondStagingWizardTourDependencies({
      operatorRegistrations: 1,
      urbanRegistrations: 0,
      transportAllocations: 0,
      rosterFreezes: 0,
      reminderActivations: 0,
    })
  );
});

test("second staging wizard cleanup title recovery has a bounded run window", () => {
  const window = getSecondStagingWizardTourCreatedAtWindow("2026-10-30T10:00:00.000Z");
  assert.equal(window.gte.toISOString(), "2026-10-30T09:55:00.000Z");
  assert.equal(window.lte.toISOString(), "2026-10-30T10:10:00.000Z");
  assert.throws(() => getSecondStagingWizardTourCreatedAtWindow("2026-10-30 10:00:00Z"));
});
