import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFirstStagingDraftTourHasNoDependencies,
  assertFirstStagingDraftTourManifest,
  assertFirstStagingDraftTourRowMatches,
  assertFirstStagingDraftTourStoredStateMatches,
  buildFirstStagingDraftTourManifest,
  buildFirstStagingDraftTourPlan,
} from "../scripts/lib/denali-first-staging-draft-tour-plan";
import { assertFirstStagingDraftTourTarget } from "../scripts/lib/denali-first-staging-draft-tour-target";
import { FIRST_STAGING_TENANT } from "../scripts/lib/denali-second-staging-fixtures";

const validStagingEnv = {
  NODE_ENV: "production",
  APP_INFRA_PROFILE: "staging",
  ENV_DIR: "/etc/app-tour-staging",
  DEPLOY_ROOT: "/opt/app-tour-staging",
  STORAGE_DRIVER: "prisma",
  DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST: "db.internal",
  DATABASE_URL: "postgresql://app_tour:app-secret@db.internal:5432/tour_db_staging?schema=public",
  DATABASE_URL_ADMIN:
    "postgresql://postgres:admin-secret@db.internal:5432/tour_db_staging?schema=public",
};

test("A draft tour plan is deterministic, run-scoped, and contains no business records", () => {
  const first = buildFirstStagingDraftTourPlan("qa2-20261029-acceptance-01");
  const repeat = buildFirstStagingDraftTourPlan("qa2-20261029-acceptance-01");
  const nextRun = buildFirstStagingDraftTourPlan("qa2-20261029-acceptance-02");
  const data = first.tour.canonical.data as Record<string, unknown>;

  assert.deepEqual(repeat, first);
  assert.equal(first.tenantId, FIRST_STAGING_TENANT.id);
  assert.equal(first.tour.tenantId, FIRST_STAGING_TENANT.id);
  assert.notEqual(first.tour.id, nextRun.tour.id);
  assert.match(first.tour.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  assert.equal(data.publishStatus, "draft");
  assert.equal(data.title, "S2-E04 A draft qa2-20261029-acceptance-01");
  assert.equal((data.basics as Record<string, unknown>).title, data.title);
  assert.equal(first.tour.createdAt, "2026-10-29T00:00:00.000Z");
  assert.equal(first.tour.rowVersion, 1);
  assert.equal("registration" in data, false);
  assert.equal("payment" in data, false);
});

test("A draft tour plan rejects malformed run IDs", () => {
  for (const runId of ["", "../escape", "contains spaces", "a".repeat(65)]) {
    assert.throws(
      () => buildFirstStagingDraftTourPlan(runId),
      /DENALI_FIRST_STAGING_DRAFT_TOUR_RUN_ID_INVALID/
    );
  }
});

test("row reconciliation accepts only the exact deterministic A fixture", () => {
  const plan = buildFirstStagingDraftTourPlan("qa2-20261029-acceptance-03");
  assert.equal(
    assertFirstStagingDraftTourRowMatches(
      { tenantId: plan.tenantId, canonical: plan.tour.canonical },
      { tenantId: plan.tenantId, canonical: plan.tour.canonical }
    ),
    true
  );
  assert.equal(
    assertFirstStagingDraftTourRowMatches(null, {
      tenantId: plan.tenantId,
      canonical: plan.tour.canonical,
    }),
    false
  );
  assert.throws(
    () =>
      assertFirstStagingDraftTourRowMatches(
        { tenantId: "00000000-0000-4000-8000-000000000004", canonical: plan.tour.canonical },
        { tenantId: plan.tenantId, canonical: plan.tour.canonical }
      ),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_COLLISION/
  );
  assert.throws(
    () =>
      assertFirstStagingDraftTourRowMatches(
        { tenantId: plan.tenantId, canonical: { ...plan.tour.canonical, schemaVersion: 99 } },
        { tenantId: plan.tenantId, canonical: plan.tour.canonical }
      ),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_COLLISION/
  );
});

test("stored fixture reconciliation rejects drift in every scalar projection", () => {
  const plan = buildFirstStagingDraftTourPlan("qa2-20261029-acceptance-03b");
  const row = {
    tenantId: plan.tenantId,
    canonical: plan.tour.canonical,
    title: plan.tour.canonical.data.title as string,
    publishStatus: "draft",
    schemaVersion: plan.tour.canonical.schemaVersion,
    rowVersion: plan.tour.rowVersion,
    createdAt: new Date(plan.tour.createdAt),
  };
  assert.equal(assertFirstStagingDraftTourStoredStateMatches(row, plan.tour), true);
  for (const drift of [
    { title: "unexpected" },
    { publishStatus: "active" },
    { schemaVersion: row.schemaVersion + 1 },
    { rowVersion: row.rowVersion + 1 },
    { createdAt: new Date("2026-10-30T00:00:00.000Z") },
  ]) {
    assert.throws(
      () => assertFirstStagingDraftTourStoredStateMatches({ ...row, ...drift }, plan.tour),
      /DENALI_FIRST_STAGING_DRAFT_TOUR_COLLISION/
    );
  }
});

test("manifest is exact, A-only, and rejects extra or altered fields", () => {
  const manifest = buildFirstStagingDraftTourManifest(
    buildFirstStagingDraftTourPlan("qa2-20261029-acceptance-04")
  );
  assert.equal(manifest.tenantId, FIRST_STAGING_TENANT.id);
  assert.doesNotThrow(() => assertFirstStagingDraftTourManifest(manifest, manifest));
  assert.throws(
    () => assertFirstStagingDraftTourManifest({ ...manifest, unrelated: true }, manifest),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_MANIFEST_REJECTED/
  );
  assert.throws(
    () => assertFirstStagingDraftTourManifest({ ...manifest, tenantId: "foreign" }, manifest),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_MANIFEST_REJECTED/
  );
  assert.throws(
    () =>
      assertFirstStagingDraftTourManifest(
        { ...manifest, source: "denali-second-staging-fixtures" },
        manifest
      ),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_MANIFEST_REJECTED/
  );
});

test("cleanup dependencies must all be zero and valid counts", () => {
  const clean = {
    operatorRegistrations: 0,
    urbanRegistrations: 0,
    transportAllocations: 0,
    rosterFreezes: 0,
    outboxEvents: 0,
    exposureReminderActivations: 0,
  };
  assert.doesNotThrow(() => assertFirstStagingDraftTourHasNoDependencies(clean));
  for (const field of Object.keys(clean) as (keyof typeof clean)[]) {
    assert.throws(
      () => assertFirstStagingDraftTourHasNoDependencies({ ...clean, [field]: 1 }),
      /DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_DEPENDENCY_FOUND/
    );
  }
  for (const badCount of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => assertFirstStagingDraftTourHasNoDependencies({ ...clean, outboxEvents: badCount }),
      /DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_DEPENDENCY_FOUND/
    );
  }
});

test("A draft seed and cleanup require separate exact staging confirmations", () => {
  assert.doesNotThrow(() => assertFirstStagingDraftTourTarget(validStagingEnv, false, "seed"));
  assert.doesNotThrow(() => assertFirstStagingDraftTourTarget(validStagingEnv, false, "cleanup"));
  assert.throws(
    () => assertFirstStagingDraftTourTarget(validStagingEnv, true, "seed"),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRMATION_REQUIRED/
  );
  assert.throws(
    () => assertFirstStagingDraftTourTarget(validStagingEnv, true, "cleanup"),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRMATION_REQUIRED/
  );
  assert.doesNotThrow(() =>
    assertFirstStagingDraftTourTarget(
      {
        ...validStagingEnv,
        DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRM:
          "seed-denali-first-s2e-draft-tour-to-tour_db_staging",
      },
      true,
      "seed"
    )
  );
  assert.doesNotThrow(() =>
    assertFirstStagingDraftTourTarget(
      {
        ...validStagingEnv,
        DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_CONFIRM:
          "cleanup-denali-first-s2e-draft-tour-from-tour_db_staging",
      },
      true,
      "cleanup"
    )
  );
  assert.throws(
    () =>
      assertFirstStagingDraftTourTarget(
        { ...validStagingEnv, DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRM: "wrong" },
        true,
        "seed"
      ),
    /DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRMATION_REQUIRED/
  );
});
