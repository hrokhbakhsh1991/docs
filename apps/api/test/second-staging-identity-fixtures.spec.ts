import assert from "node:assert/strict";
import test from "node:test";
import { resolveLoginMobileLookupKeys } from "../src/identity/canonicalize-login-mobile";

import {
  assertStagingIdentityTenantExclusive,
  assertSecondStagingFixtureIdentityMembership,
  assertSecondStagingIdentityLoginPolicy,
  assertSecondStagingIdentityOtpChallengesClear,
  canDeleteStagingIdentityUsers,
  FIRST_STAGING_IDENTITY_IDS,
  FIRST_STAGING_TENANT,
  LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS,
  planSecondStagingIdentityWrites,
  resolveFirstStagingIdentityFixtures,
  resolveSecondStagingIdentityFixtures,
  SECOND_STAGING_IDENTITY_IDS,
  SECOND_STAGING_TENANT,
  type ExistingStagingMembership,
} from "../scripts/lib/denali-second-staging-fixtures";

const env = {
  DENALI_SECOND_STAGING_OWNER_MOBILE: "+15550009006",
  DENALI_SECOND_STAGING_FINANCE_MOBILE: "+15550009004",
  DENALI_SECOND_STAGING_MEMBER_MOBILE: "+15550009005",
};

const firstTenantEnv = {
  DENALI_FIRST_STAGING_OWNER_MOBILE: "09120000011",
  DENALI_FIRST_STAGING_FINANCE_MOBILE: "09120000012",
};

const fixtures = () => resolveSecondStagingIdentityFixtures(env);
const users = () => fixtures().map(({ userId, mobile }) => ({ id: userId, mobile }));
const memberships = (): ExistingStagingMembership[] =>
  fixtures().map((fixture) => ({
    userId: fixture.userId,
    tenantId: fixture.tenantId,
    role: fixture.role,
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: fixture.workspaceId,
    membershipMetadata: { displayName: fixture.displayName },
  }));

test("resolves only new B Owner, Finance and Member fixtures in the reserved synthetic namespace", () => {
  const resolved = fixtures();
  assert.equal(resolved.length, 3);
  assert.deepEqual(
    resolved.map(({ label, role }) => [label, role]),
    [
      ["owner", "owner"],
      ["finance", "admin"],
      ["member", "member"],
    ]
  );
  assert.ok(
    resolved.every(
      ({ tenantId, workspaceId }) =>
        tenantId === SECOND_STAGING_TENANT.id && workspaceId === SECOND_STAGING_TENANT.workspaceId
    )
  );
  assert.equal(new Set(resolved.map(({ userId }) => userId)).size, 3);
  assert.equal(new Set(resolved.map(({ mobile }) => mobile)).size, 3);
  assert.deepEqual(
    resolved.map(({ userId }) => userId),
    [
      SECOND_STAGING_IDENTITY_IDS.owner,
      SECOND_STAGING_IDENTITY_IDS.finance,
      SECOND_STAGING_IDENTITY_IDS.member,
    ]
  );
  assert.ok(resolved.every(({ mobile }) => /^\+1555\d{7}$/.test(mobile)));
  assert.notEqual(
    SECOND_STAGING_IDENTITY_IDS.owner,
    LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS.owner
  );
});

test("resolves only the reserved A Owner and Finance fixtures", () => {
  const resolved = resolveFirstStagingIdentityFixtures(firstTenantEnv);

  assert.deepEqual(
    resolved.map(({ label, userId, role, workspaceId, displayName, tenantId }) => ({
      label,
      userId,
      role,
      workspaceId,
      displayName,
      tenantId,
    })),
    [
      {
        label: "owner",
        userId: FIRST_STAGING_IDENTITY_IDS.owner,
        role: "owner",
        workspaceId: FIRST_STAGING_TENANT.workspaceId,
        displayName: "QA A Owner",
        tenantId: FIRST_STAGING_TENANT.id,
      },
      {
        label: "finance",
        userId: FIRST_STAGING_IDENTITY_IDS.finance,
        role: "admin",
        workspaceId: FIRST_STAGING_TENANT.workspaceId,
        displayName: "QA A Finance Operator",
        tenantId: FIRST_STAGING_TENANT.id,
      },
    ]
  );
  assert.deepEqual(
    resolved.map(({ mobile }) => mobile),
    ["09120000011", "09120000012"]
  );
  assert.equal(new Set(resolved.map(({ userId }) => userId)).size, 2);
  assert.equal(new Set(resolved.map(({ mobile }) => mobile)).size, 2);
  assert.ok(resolved.every(({ tenantId }) => tenantId !== SECOND_STAGING_TENANT.id));
});

test("requires both A Owner and Finance mobiles and rejects duplicate A mobiles", () => {
  assert.throws(
    () =>
      resolveFirstStagingIdentityFixtures({
        DENALI_FIRST_STAGING_OWNER_MOBILE: firstTenantEnv.DENALI_FIRST_STAGING_OWNER_MOBILE,
      }),
    /DENALI_SECOND_STAGING_IDENTITY_MOBILE_REQUIRED/
  );
  assert.throws(
    () =>
      resolveFirstStagingIdentityFixtures({
        ...firstTenantEnv,
        DENALI_FIRST_STAGING_FINANCE_MOBILE: "+989120000011",
      }),
    /DENALI_SECOND_STAGING_IDENTITY_MOBILE_DUPLICATE/
  );
});

test("accepts reserved A identities with memberships only in tenant A", () => {
  const resolved = resolveFirstStagingIdentityFixtures(firstTenantEnv);

  assert.doesNotThrow(() =>
    assertStagingIdentityTenantExclusive(
      resolved,
      resolved.map(({ userId, tenantId }) => ({ userId, tenantId }))
    )
  );
});

test("rejects a reserved A identity membership in another tenant", () => {
  const [owner] = resolveFirstStagingIdentityFixtures(firstTenantEnv);
  assert.ok(owner);

  assert.throws(
    () =>
      assertStagingIdentityTenantExclusive(
        [owner],
        [{ userId: owner.userId, tenantId: SECOND_STAGING_TENANT.id }]
      ),
    /DENALI_SECOND_STAGING_IDENTITY_TENANT_COLLISION/
  );
});

test("preserves synthetic users when any persisted row still references them", () => {
  assert.equal(canDeleteStagingIdentityUsers(0), true);
  assert.equal(canDeleteStagingIdentityUsers(1), false);
  assert.equal(canDeleteStagingIdentityUsers(25), false);
  assert.throws(
    () => canDeleteStagingIdentityUsers(-1),
    /DENALI_SECOND_STAGING_IDENTITY_REFERENCE_COUNT_INVALID/
  );
});

test("requires static staging OTP and rejects live SMS delivery", () => {
  assert.doesNotThrow(() =>
    assertSecondStagingIdentityLoginPolicy({ STAGING_ALLOW_STATIC_OTP: "true" })
  );
  assert.throws(
    () => assertSecondStagingIdentityLoginPolicy({ STAGING_ALLOW_STATIC_OTP: "false" }),
    /DENALI_SECOND_STAGING_IDENTITY_LOGIN_POLICY_REJECTED/
  );
  assert.throws(
    () =>
      assertSecondStagingIdentityLoginPolicy({
        STAGING_ALLOW_STATIC_OTP: "true",
        SMS_OTP_ENABLED: "true",
      }),
    /DENALI_SECOND_STAGING_IDENTITY_LOGIN_POLICY_REJECTED/
  );
});

test("rejects a nonzero pre-existing OTP challenge count", () => {
  assert.doesNotThrow(() => assertSecondStagingIdentityOtpChallengesClear(0));
  assert.throws(
    () => assertSecondStagingIdentityOtpChallengesClear(1),
    (error: unknown) =>
      error instanceof Error && error.message === "DENALI_SECOND_STAGING_IDENTITY_OTP_COLLISION"
  );
});

test("requires valid mobile inputs without including the input in errors", () => {
  assert.throws(
    () => resolveSecondStagingIdentityFixtures({ ...env, DENALI_SECOND_STAGING_MEMBER_MOBILE: "" }),
    (error: unknown) =>
      error instanceof Error && error.message === "DENALI_SECOND_STAGING_IDENTITY_MOBILE_REQUIRED"
  );
  assert.throws(
    () =>
      resolveSecondStagingIdentityFixtures({
        ...env,
        DENALI_SECOND_STAGING_MEMBER_MOBILE: "not a phone",
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "DENALI_SECOND_STAGING_IDENTITY_MOBILE_INVALID"
  );
});

test("requires a separate synthetic B Owner and does not reuse the legacy manifest identity", () => {
  const resolved = resolveSecondStagingIdentityFixtures(env);
  assert.deepEqual(
    resolved.map(({ label }) => label),
    ["owner", "finance", "member"]
  );
  assert.equal(resolved[0]?.userId, SECOND_STAGING_IDENTITY_IDS.owner);
  assert.notEqual(resolved[0]?.userId, LEGACY_SECOND_STAGING_FIXTURE_IDENTITY_IDS.owner);
  assert.throws(
    () =>
      resolveSecondStagingIdentityFixtures({
        DENALI_SECOND_STAGING_FINANCE_MOBILE: env.DENALI_SECOND_STAGING_FINANCE_MOBILE,
        DENALI_SECOND_STAGING_MEMBER_MOBILE: env.DENALI_SECOND_STAGING_MEMBER_MOBILE,
      }),
    /DENALI_SECOND_STAGING_IDENTITY_MOBILE_REQUIRED/
  );
});

test("checks B fixture readiness by fixed identity ID and expected role only", () => {
  for (const [label, role] of [
    ["owner", "owner"],
    ["finance", "admin"],
    ["member", "member"],
  ] as const) {
    assert.doesNotThrow(() =>
      assertSecondStagingFixtureIdentityMembership(label, {
        userId: SECOND_STAGING_IDENTITY_IDS[label],
        role,
        status: "ACTIVE",
        workspaceId: SECOND_STAGING_TENANT.workspaceId,
      })
    );
  }
  assert.throws(
    () =>
      assertSecondStagingFixtureIdentityMembership("finance", {
        userId: SECOND_STAGING_IDENTITY_IDS.owner,
        role: "admin",
        status: "ACTIVE",
        workspaceId: SECOND_STAGING_TENANT.workspaceId,
      }),
    /DENALI_SECOND_STAGING_FIXTURE_IDENTITY_NOT_READY/
  );
});

test("rejects valid real-number-format B inputs outside the approved synthetic namespace", () => {
  assert.throws(
    () =>
      resolveSecondStagingIdentityFixtures({
        ...env,
        DENALI_SECOND_STAGING_FINANCE_MOBILE: "09120000004",
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "DENALI_SECOND_STAGING_IDENTITY_MOBILE_NOT_SYNTHETIC"
  );
});

test("rejects wrong-length values inside the +1555 synthetic prefix", () => {
  assert.throws(
    () =>
      resolveSecondStagingIdentityFixtures({
        ...env,
        DENALI_SECOND_STAGING_FINANCE_MOBILE: "+155500090004",
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "DENALI_SECOND_STAGING_IDENTITY_MOBILE_NOT_SYNTHETIC"
  );
});

test("rejects duplicate canonical mobile values", () => {
  assert.throws(
    () =>
      resolveSecondStagingIdentityFixtures({
        ...env,
        DENALI_SECOND_STAGING_MEMBER_MOBILE: env.DENALI_SECOND_STAGING_FINANCE_MOBILE,
      }),
    /DENALI_SECOND_STAGING_IDENTITY_MOBILE_DUPLICATE/
  );
});

test("uses the API login lookup aliases for Iranian mobile collision checks", () => {
  const lookupKeys = resolveLoginMobileLookupKeys("+989120000001");
  assert.ok(lookupKeys.includes("09120000001"));
  assert.ok(lookupKeys.includes("+989120000001"));
});

test("plans only missing users and memberships", () => {
  const plan = planSecondStagingIdentityWrites(
    fixtures(),
    [null, null, null],
    [[], [], []],
    [null, null, null]
  );
  assert.equal(plan.usersToCreate.length, 3);
  assert.equal(plan.membershipsToCreate.length, 3);
  assert.equal(plan.alreadyPresent.length, 0);
});

test("accepts exact existing fixtures for a safe idempotent rerun", () => {
  const resolved = fixtures();
  const existingUsers = resolved.map(({ userId, mobile }) => ({ id: userId, mobile }));
  const plan = planSecondStagingIdentityWrites(
    resolved,
    existingUsers,
    existingUsers.map((user) => [user]),
    memberships()
  );
  assert.equal(plan.usersToCreate.length, 0);
  assert.equal(plan.membershipsToCreate.length, 0);
  assert.equal(plan.alreadyPresent.length, 3);
});

test("rejects a reserved user ID or mobile owned by a different user", () => {
  const resolved = fixtures();
  assert.throws(
    () =>
      planSecondStagingIdentityWrites(
        resolved,
        [{ id: resolved[0]!.userId, mobile: "+15550009999" }, null, null],
        [[], [], []],
        [null, null, null]
      ),
    /DENALI_SECOND_STAGING_IDENTITY_COLLISION/
  );
  assert.throws(
    () =>
      planSecondStagingIdentityWrites(
        resolved,
        [null, null, null],
        [[{ id: "00000000-0000-4000-8000-000000000003", mobile: resolved[0]!.mobile }], [], []],
        [null, null, null]
      ),
    /DENALI_SECOND_STAGING_IDENTITY_COLLISION/
  );
});

test("rejects a pre-existing membership with a different role or workspace", () => {
  const current = memberships();
  current[0] = { ...current[0]!, role: "admin" };
  assert.throws(
    () =>
      planSecondStagingIdentityWrites(
        fixtures(),
        users(),
        users().map((user) => [user]),
        current
      ),
    /DENALI_SECOND_STAGING_MEMBERSHIP_COLLISION/
  );
});

test("rejects incomplete collision preflight results", () => {
  assert.throws(
    () => planSecondStagingIdentityWrites(fixtures(), [], [], []),
    /DENALI_SECOND_STAGING_IDENTITY_PREFLIGHT_INCOMPLETE/
  );
});
