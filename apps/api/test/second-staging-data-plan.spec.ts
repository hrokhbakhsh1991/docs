import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSecondStagingFixtureRowMatches,
  buildSecondStagingDataPlan,
  isSecondStagingWizardTemplateReady,
} from "../scripts/lib/denali-second-staging-data-plan";
import {
  SECOND_STAGING_IDENTITY_IDS,
  SECOND_STAGING_TENANT,
} from "../scripts/lib/denali-second-staging-fixtures";

const run = (runId: string) =>
  buildSecondStagingDataPlan({
    runId,
    identityUserIds: SECOND_STAGING_IDENTITY_IDS,
  });

test("second staging data plan is deterministic and links every child to B and its run", () => {
  const first = run("run-20261029-a");
  const again = run("run-20261029-a");
  const second = run("run-20261029-b");

  assert.deepEqual(again, first);
  assert.equal(first.ids.tenantId, SECOND_STAGING_TENANT.id);
  assert.equal(first.catalogs.destination.regionId, first.catalogs.region.id);
  assert.equal(first.catalogs.preset.themeId, first.catalogs.theme.id);
  assert.deepEqual(first.catalogs.equipment.themeIds, [first.catalogs.theme.id]);
  assert.equal(first.tours.free.tenantId, first.ids.tenantId);
  assert.equal(first.tours.paid.tenantId, first.ids.tenantId);
  assert.notEqual(first.tours.free.id, first.tours.paid.id);
  assert.notEqual(first.tours.free.canonical, first.tours.paid.canonical);
  assert.equal(first.registrations.free.tourId, first.tours.free.id);
  assert.equal(first.registrations.paid.tourId, first.tours.paid.id);
  assert.equal(first.registrations.free.submittedByUserId, first.ids.identities.member);
  assert.equal(first.registrations.paid.submittedByUserId, first.ids.identities.member);
  assert.equal(first.registrations.paid.registrationIntake.runId, first.ids.runId);
  assert.notEqual(first.registrations.free.id, second.registrations.free.id);
  assert.notEqual(first.registrations.paid.id, second.registrations.paid.id);
  assert.equal(first.registrations.paid.guestEmail, null);
  assert.equal(first.registrations.paid.guestPhone, null);
});

test("second staging data plan produces free and offline-receipt tours for future dates", () => {
  const plan = run("run-20261029-c");
  const freeData = plan.tours.free.canonical.data as Record<string, unknown>;
  const paidData = plan.tours.paid.canonical.data as Record<string, unknown>;
  const freePricing = freeData.pricing as Record<string, unknown>;
  const paidPricing = paidData.pricing as Record<string, unknown>;

  assert.equal(freePricing.paymentCollection, "free");
  assert.equal(paidPricing.paymentCollection, "offline");
  assert.equal(paidPricing.paymentMode, "offline_receipt");
  assert.equal(freeData.destinationId, plan.catalogs.destination.id);
  assert.deepEqual((freeData.program as Record<string, unknown>).themeIds, [
    plan.catalogs.theme.id,
  ]);
  assert.ok(Date.parse(freeData.startDateTime as string) > Date.now());
  assert.ok(Date.parse(paidData.startDateTime as string) > Date.now());
  assert.equal(plan.registrations.free.status, "pending");
  assert.equal(plan.registrations.paid.status, "pending");
  assert.equal(plan.registrations.paid.paymentStatus, "unpaid");
});

test("fixture reconciliation reuses exact rows and ignores JSON key order", () => {
  const expected = {
    tenantId: SECOND_STAGING_TENANT.id,
    payload: { runId: "run-20261029-d", nested: { a: 1, b: 2 } },
  };
  assert.equal(
    assertSecondStagingFixtureRowMatches(
      {
        tenantId: SECOND_STAGING_TENANT.id,
        payload: { nested: { b: 2, a: 1 }, runId: "run-20261029-d" },
      },
      expected,
      ["tenantId", "payload"],
      "FIXTURE_COLLISION"
    ),
    true
  );
  assert.equal(
    assertSecondStagingFixtureRowMatches(null, expected, ["tenantId"], "FIXTURE_COLLISION"),
    false
  );
  assert.throws(
    () =>
      assertSecondStagingFixtureRowMatches(
        { ...expected, tenantId: "00000000-0000-4000-8000-000000000001" },
        expected,
        ["tenantId"],
        "FIXTURE_COLLISION"
      ),
    /FIXTURE_COLLISION/
  );
});

test("fixture reconciliation compares database timestamps by value", () => {
  const timestamp = "2026-10-29T00:00:00.000Z";
  assert.equal(
    assertSecondStagingFixtureRowMatches(
      { createdAt: new Date(timestamp) },
      { createdAt: timestamp },
      ["createdAt"],
      "FIXTURE_COLLISION"
    ),
    true
  );
});

test("wizard template is reusable only when published with enough steps", () => {
  assert.equal(isSecondStagingWizardTemplateReady({ published: true, steps: [{}, {}] }, 2), true);
  assert.equal(isSecondStagingWizardTemplateReady({ published: false, steps: [{}, {}] }, 2), false);
  assert.equal(isSecondStagingWizardTemplateReady({ published: true, steps: [{}] }, 2), false);
  assert.equal(isSecondStagingWizardTemplateReady(null, 2), false);
});
