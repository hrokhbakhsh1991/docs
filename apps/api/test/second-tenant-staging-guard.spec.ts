import assert from "node:assert/strict";
import test from "node:test";

import { assertSecondTenantStagingTarget } from "../scripts/lib/denali-second-staging-target";

const validEnv = {
  NODE_ENV: "production",
  APP_INFRA_PROFILE: "staging",
  ENV_DIR: "/etc/app-tour-staging",
  DEPLOY_ROOT: "/opt/app-tour-staging",
  STORAGE_DRIVER: "prisma",
  DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST: "db.internal",
  DATABASE_URL: "postgresql://app_tour:app-secret@db.internal:5432/tour_db_staging?schema=public",
  DATABASE_URL_ADMIN:
    "postgresql://postgres:admin-secret@db.internal:5432/tour_db_staging?schema=public",
  DENALI_SECOND_TENANT_STAGING_CONFIRM: "provision-denali-qa2-to-tour_db_staging",
  DENALI_SECOND_TENANT_STAGING_IDENTITIES_CONFIRM: "seed-denali-qa2-identities-to-tour_db_staging",
  DENALI_FIRST_STAGING_IDENTITIES_CONFIRM: "seed-denali-a-identities-to-tour_db_staging",
};

test("accepts the pinned staging target for dry run and apply", () => {
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(validEnv));
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(validEnv, true));
});

test("rejects production app, wrong infra profile, env dir, or deploy root", () => {
  for (const patch of [
    { NODE_ENV: "development" },
    { APP_INFRA_PROFILE: "production" },
    { ENV_DIR: "/etc/app-tour" },
    { DEPLOY_ROOT: "/opt/app-tour" },
  ]) {
    assert.throws(() => assertSecondTenantStagingTarget({ ...validEnv, ...patch }));
  }
});

test("rejects wrong database, mismatched database host, and app role as admin", () => {
  for (const patch of [
    { DATABASE_URL: validEnv.DATABASE_URL.replace("tour_db_staging", "tour_db") },
    {
      DATABASE_URL_ADMIN: validEnv.DATABASE_URL_ADMIN.replace("db.internal", "other.internal"),
    },
    { DATABASE_URL_ADMIN: validEnv.DATABASE_URL },
    { DATABASE_URL_ADMIN: validEnv.DATABASE_URL_ADMIN.replace("postgres", "db_admin") },
    { STORAGE_DRIVER: "memory" },
  ]) {
    assert.throws(() => assertSecondTenantStagingTarget({ ...validEnv, ...patch }));
  }
});

test("requires exact database hosts from the configured staging allowlist", () => {
  const { DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST: _allowlist, ...withoutAllowlist } =
    validEnv;
  assert.throws(
    () => assertSecondTenantStagingTarget(withoutAllowlist),
    /DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED/
  );

  for (const allowlist of [
    "",
    "db.internal,",
    "*.internal",
    "db.internal:5432",
    "https://db.internal",
  ]) {
    assert.throws(
      () =>
        assertSecondTenantStagingTarget({
          ...validEnv,
          DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST: allowlist,
        }),
      /DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED/
    );
  }

  assert.throws(
    () =>
      assertSecondTenantStagingTarget({
        ...validEnv,
        DATABASE_URL: validEnv.DATABASE_URL.replace("db.internal", "other.internal"),
        DATABASE_URL_ADMIN: validEnv.DATABASE_URL_ADMIN.replace("db.internal", "other.internal"),
      }),
    /DENALI_SECOND_TENANT_STAGING_DATABASE_REJECTED/
  );
  assert.doesNotThrow(() =>
    assertSecondTenantStagingTarget({
      ...validEnv,
      DENALI_SECOND_TENANT_STAGING_DATABASE_HOST_ALLOWLIST: "other.internal, DB.INTERNAL",
    })
  );
});

test("apply requires the exact staging confirmation while dry run does not", () => {
  const { DENALI_SECOND_TENANT_STAGING_CONFIRM: _confirmation, ...withoutConfirmation } = validEnv;
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(withoutConfirmation));
  assert.throws(() => assertSecondTenantStagingTarget(withoutConfirmation, true));
});

test("identity apply requires its separate exact staging confirmation", () => {
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(validEnv, true, "identities"));
  const {
    DENALI_SECOND_TENANT_STAGING_IDENTITIES_CONFIRM: _confirmation,
    ...withoutIdentityConfirmation
  } = validEnv;
  assert.throws(() =>
    assertSecondTenantStagingTarget(withoutIdentityConfirmation, true, "identities")
  );
});

test("A-side identity apply requires a distinct exact staging confirmation", () => {
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(validEnv, true, "aIdentities"));
  assert.throws(
    () =>
      assertSecondTenantStagingTarget(
        {
          ...validEnv,
          DENALI_FIRST_STAGING_IDENTITIES_CONFIRM: "seed-denali-qa2-identities-to-tour_db_staging",
        },
        true,
        "aIdentities"
      ),
    /DENALI_SECOND_TENANT_STAGING_CONFIRMATION_REQUIRED/
  );
  assert.throws(() => {
    const { DENALI_FIRST_STAGING_IDENTITIES_CONFIRM: _confirmation, ...withoutConfirmation } =
      validEnv;
    assertSecondTenantStagingTarget(withoutConfirmation, true, "aIdentities");
  }, /DENALI_SECOND_TENANT_STAGING_CONFIRMATION_REQUIRED/);
});

test("A-side identity cleanup apply requires its own exact staging confirmation", () => {
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(validEnv, false, "aIdentitiesCleanup"));
  assert.throws(
    () => assertSecondTenantStagingTarget(validEnv, true, "aIdentitiesCleanup"),
    /DENALI_SECOND_TENANT_STAGING_CONFIRMATION_REQUIRED/
  );
  assert.doesNotThrow(() =>
    assertSecondTenantStagingTarget(
      {
        ...validEnv,
        DENALI_FIRST_STAGING_IDENTITIES_CLEANUP_CONFIRM:
          "cleanup-denali-a-identities-from-tour_db_staging",
      },
      true,
      "aIdentitiesCleanup"
    )
  );
});

test("fixture apply requires its separate exact staging confirmation", () => {
  const env = { ...validEnv };
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(env, false, "fixtures"));
  const { DATABASE_URL_ADMIN: _adminUrl, ...withoutAdminUrl } = env;
  assert.throws(() => assertSecondTenantStagingTarget(withoutAdminUrl, false, "fixtures"));
  assert.throws(
    () => assertSecondTenantStagingTarget(env, true, "fixtures"),
    /DENALI_SECOND_TENANT_STAGING_CONFIRMATION_REQUIRED/
  );
  assert.doesNotThrow(() =>
    assertSecondTenantStagingTarget(
      {
        ...env,
        DENALI_SECOND_TENANT_STAGING_FIXTURES_CONFIRM:
          "seed-denali-qa2-fixtures-to-tour_db_staging",
      },
      true,
      "fixtures"
    )
  );
});

test("cleanup apply requires its own exact staging confirmation", () => {
  assert.doesNotThrow(() => assertSecondTenantStagingTarget(validEnv, false, "cleanup"));
  assert.throws(
    () => assertSecondTenantStagingTarget(validEnv, true, "cleanup"),
    /DENALI_SECOND_TENANT_STAGING_CONFIRMATION_REQUIRED/
  );
  assert.doesNotThrow(() =>
    assertSecondTenantStagingTarget(
      {
        ...validEnv,
        DENALI_SECOND_TENANT_STAGING_CLEANUP_CONFIRM:
          "cleanup-denali-qa2-fixtures-from-tour_db_staging",
      },
      true,
      "cleanup"
    )
  );
});
