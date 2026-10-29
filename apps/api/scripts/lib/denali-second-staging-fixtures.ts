import { canonicalizeLoginMobile } from "../../src/identity/canonicalize-login-mobile";
import { isLoginMobileFormatValid } from "../../src/identity/phone-login-authorization";

export const SECOND_STAGING_TENANT = {
  id: "f0ed9e65-2638-4351-847d-724f87ebbfce",
  subdomain: "denali-qa2",
  workspaceType: "denali",
  status: "active",
  workspaceId: "ws-denali-qa2",
} as const;

export const FIRST_STAGING_TENANT = {
  id: "00000000-0000-4000-8000-000000000003",
  subdomain: "denali",
  workspaceType: "denali",
  status: "active",
  workspaceId: "ws-denali-dev",
} as const;

export type SecondStagingIdentityRole = "owner" | "admin" | "member";
export type SecondStagingFixtureLabel = "owner" | "finance" | "member";

export type SecondStagingIdentityFixture = Readonly<{
  label: SecondStagingFixtureLabel;
  userId: string;
  mobile: string;
  role: SecondStagingIdentityRole;
  workspaceId: string;
  displayName: string;
  tenantId: string;
}>;

export type ExistingStagingUser = Readonly<{ id: string; mobile: string }>;
export type ExistingStagingMembership = Readonly<{
  userId: string;
  tenantId: string;
  role: string;
  status: string;
  sessionVersion: number;
  workspaceId: string | null;
  membershipMetadata: unknown;
}>;
export type ExistingStagingMembershipTenant = Readonly<{ userId: string; tenantId: string }>;

export type SecondStagingIdentityWritePlan = Readonly<{
  usersToCreate: readonly SecondStagingIdentityFixture[];
  membershipsToCreate: readonly SecondStagingIdentityFixture[];
  alreadyPresent: readonly SecondStagingIdentityFixture[];
}>;

const MOBILE_ENV: Readonly<Record<SecondStagingFixtureLabel, string>> = {
  owner: "DENALI_SECOND_STAGING_OWNER_MOBILE",
  finance: "DENALI_SECOND_STAGING_FINANCE_MOBILE",
  member: "DENALI_SECOND_STAGING_MEMBER_MOBILE",
};

const FIRST_MOBILE_ENV = {
  owner: "DENALI_FIRST_STAGING_OWNER_MOBILE",
  finance: "DENALI_FIRST_STAGING_FINANCE_MOBILE",
} as const;

export const SECOND_STAGING_IDENTITY_IDS: Readonly<Record<SecondStagingFixtureLabel, string>> = {
  owner: "c51ad260-53cd-49c9-8d43-72fbc0129001",
  finance: "c51ad260-53cd-49c9-8d43-72fbc0129002",
  member: "c51ad260-53cd-49c9-8d43-72fbc0129003",
};

export const FIRST_STAGING_IDENTITY_IDS = {
  owner: "00000000-0000-4000-8000-000000000401",
  finance: "00000000-0000-4000-8000-000000000402",
} as const;

const ROLE_BY_LABEL: Readonly<Record<SecondStagingFixtureLabel, SecondStagingIdentityRole>> = {
  owner: "owner",
  finance: "admin",
  member: "member",
};

const DISPLAY_NAME_BY_LABEL: Readonly<Record<SecondStagingFixtureLabel, string>> = {
  owner: "QA2 Owner",
  finance: "QA2 Finance Operator",
  member: "QA2 Member",
};

function identityConflict(code: string): never {
  throw new Error(code);
}

/** Staging identity login must use the static OTP path without enabling live SMS delivery. */
export function assertSecondStagingIdentityLoginPolicy(
  env: Readonly<Record<string, string | undefined>>
): void {
  if (
    env.STAGING_ALLOW_STATIC_OTP?.trim() !== "true" ||
    env.SMS_OTP_ENABLED?.trim().toLowerCase() === "true"
  ) {
    identityConflict("DENALI_SECOND_STAGING_IDENTITY_LOGIN_POLICY_REJECTED");
  }
}

/** Resolves synthetic B-only identities without retaining or printing the supplied phone values. */
export function resolveSecondStagingIdentityFixtures(
  env: Readonly<Record<string, string | undefined>>
): readonly SecondStagingIdentityFixture[] {
  return resolveIdentityFixtures(env, {
    labels: ["owner", "finance", "member"],
    mobileEnv: MOBILE_ENV,
    identityIds: SECOND_STAGING_IDENTITY_IDS,
    tenantId: SECOND_STAGING_TENANT.id,
    workspaceId: SECOND_STAGING_TENANT.workspaceId,
    displayNames: DISPLAY_NAME_BY_LABEL,
  });
}

/** Resolves only the reserved synthetic Owner and Finance identities for tenant A. */
export function resolveFirstStagingIdentityFixtures(
  env: Readonly<Record<string, string | undefined>>
): readonly SecondStagingIdentityFixture[] {
  return resolveIdentityFixtures(env, {
    labels: ["owner", "finance"],
    mobileEnv: FIRST_MOBILE_ENV,
    identityIds: FIRST_STAGING_IDENTITY_IDS,
    tenantId: FIRST_STAGING_TENANT.id,
    workspaceId: FIRST_STAGING_TENANT.workspaceId,
    displayNames: { owner: "QA A Owner", finance: "QA A Finance Operator" },
  });
}

type IdentityFixtureConfig = Readonly<{
  labels: readonly SecondStagingFixtureLabel[];
  mobileEnv: Readonly<Partial<Record<SecondStagingFixtureLabel, string>>>;
  identityIds: Readonly<Partial<Record<SecondStagingFixtureLabel, string>>>;
  tenantId: string;
  workspaceId: string;
  displayNames: Readonly<Partial<Record<SecondStagingFixtureLabel, string>>>;
}>;

function resolveIdentityFixtures(
  env: Readonly<Record<string, string | undefined>>,
  config: IdentityFixtureConfig
): readonly SecondStagingIdentityFixture[] {
  const fixtures = config.labels.map((label) => {
    const mobileEnv = config.mobileEnv[label];
    const userId = config.identityIds[label];
    const displayName = config.displayNames[label];
    if (mobileEnv === undefined || userId === undefined || displayName === undefined) {
      identityConflict("DENALI_STAGING_IDENTITY_FIXTURE_CONFIG_INVALID");
    }
    const rawMobile = env[mobileEnv]?.trim() ?? "";
    if (!rawMobile) identityConflict("DENALI_SECOND_STAGING_IDENTITY_MOBILE_REQUIRED");
    const mobile = canonicalizeLoginMobile(rawMobile);
    if (!isLoginMobileFormatValid(mobile)) {
      identityConflict("DENALI_SECOND_STAGING_IDENTITY_MOBILE_INVALID");
    }
    return {
      label,
      userId,
      mobile,
      role: ROLE_BY_LABEL[label],
      workspaceId: config.workspaceId,
      displayName,
      tenantId: config.tenantId,
    } satisfies SecondStagingIdentityFixture;
  });
  if (new Set(fixtures.map((fixture) => fixture.mobile)).size !== fixtures.length) {
    identityConflict("DENALI_SECOND_STAGING_IDENTITY_MOBILE_DUPLICATE");
  }
  return fixtures;
}

function membershipMatches(
  current: ExistingStagingMembership,
  expected: SecondStagingIdentityFixture
): boolean {
  const metadata = current.membershipMetadata;
  return (
    current.userId === expected.userId &&
    current.tenantId === expected.tenantId &&
    current.role === expected.role &&
    current.status === "ACTIVE" &&
    current.sessionVersion === 1 &&
    current.workspaceId === expected.workspaceId &&
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "displayName" in metadata &&
    metadata.displayName === expected.displayName
  );
}

/** Rejects any pre-existing global identity or tenant membership that is not this exact fixture. */
export function planSecondStagingIdentityWrites(
  fixtures: readonly SecondStagingIdentityFixture[],
  usersById: readonly (ExistingStagingUser | null)[],
  usersByMobile: readonly (readonly ExistingStagingUser[])[],
  memberships: readonly (ExistingStagingMembership | null)[]
): SecondStagingIdentityWritePlan {
  if (
    usersById.length !== fixtures.length ||
    usersByMobile.length !== fixtures.length ||
    memberships.length !== fixtures.length
  ) {
    identityConflict("DENALI_SECOND_STAGING_IDENTITY_PREFLIGHT_INCOMPLETE");
  }
  const usersToCreate: SecondStagingIdentityFixture[] = [];
  const membershipsToCreate: SecondStagingIdentityFixture[] = [];
  const alreadyPresent: SecondStagingIdentityFixture[] = [];

  fixtures.forEach((fixture, index) => {
    const byId = usersById[index];
    const byMobile = usersByMobile[index];
    const exactExistingUser =
      byId !== null &&
      byId.id === fixture.userId &&
      byId.mobile === fixture.mobile &&
      byMobile.length === 1 &&
      byMobile[0]?.id === fixture.userId &&
      byMobile[0]?.mobile === fixture.mobile;
    const absentUser = byId === null && byMobile.length === 0;
    if (!exactExistingUser && !absentUser) {
      identityConflict("DENALI_SECOND_STAGING_IDENTITY_COLLISION");
    }
    if (absentUser) usersToCreate.push(fixture);

    const membership = memberships[index];
    if (membership !== null && !membershipMatches(membership, fixture)) {
      identityConflict("DENALI_SECOND_STAGING_MEMBERSHIP_COLLISION");
    }
    if (membership === null) membershipsToCreate.push(fixture);
    if (exactExistingUser && membership !== null) alreadyPresent.push(fixture);
  });

  return { usersToCreate, membershipsToCreate, alreadyPresent };
}

/** Refuses to attach a reserved synthetic identity to any pre-existing tenant account. */
export function assertStagingIdentityTenantExclusive(
  fixtures: readonly SecondStagingIdentityFixture[],
  memberships: readonly ExistingStagingMembershipTenant[]
): void {
  const expectedTenantByUser = new Map(
    fixtures.map((fixture) => [fixture.userId, fixture.tenantId])
  );
  for (const membership of memberships) {
    const expectedTenantId = expectedTenantByUser.get(membership.userId);
    if (expectedTenantId !== undefined && membership.tenantId !== expectedTenantId) {
      identityConflict("DENALI_SECOND_STAGING_IDENTITY_TENANT_COLLISION");
    }
  }
}

/** Preserve identity rows whenever tenant-owned data or audit fields still reference them. */
export function canDeleteStagingIdentityUsers(userReferenceCount: number): boolean {
  if (!Number.isSafeInteger(userReferenceCount) || userReferenceCount < 0) {
    identityConflict("DENALI_SECOND_STAGING_IDENTITY_REFERENCE_COUNT_INVALID");
  }
  return userReferenceCount === 0;
}
