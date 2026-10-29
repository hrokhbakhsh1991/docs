import { canonicalizeLoginMobile } from "../../src/identity/canonicalize-login-mobile";
import { isLoginMobileFormatValid } from "../../src/identity/phone-login-authorization";

export const SECOND_STAGING_TENANT = {
  id: "f0ed9e65-2638-4351-847d-724f87ebbfce",
  subdomain: "denali-qa2",
  workspaceType: "denali",
  status: "active",
  workspaceId: "ws-denali-qa2",
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

export const SECOND_STAGING_IDENTITY_IDS: Readonly<Record<SecondStagingFixtureLabel, string>> = {
  owner: "c51ad260-53cd-49c9-8d43-72fbc0129001",
  finance: "c51ad260-53cd-49c9-8d43-72fbc0129002",
  member: "c51ad260-53cd-49c9-8d43-72fbc0129003",
};

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
  const fixtures = (["owner", "finance", "member"] as const).map((label) => {
    const rawMobile = env[MOBILE_ENV[label]]?.trim() ?? "";
    if (!rawMobile) identityConflict("DENALI_SECOND_STAGING_IDENTITY_MOBILE_REQUIRED");
    const mobile = canonicalizeLoginMobile(rawMobile);
    if (!isLoginMobileFormatValid(mobile)) {
      identityConflict("DENALI_SECOND_STAGING_IDENTITY_MOBILE_INVALID");
    }
    return {
      label,
      userId: SECOND_STAGING_IDENTITY_IDS[label],
      mobile,
      role: ROLE_BY_LABEL[label],
      workspaceId: SECOND_STAGING_TENANT.workspaceId,
      displayName: DISPLAY_NAME_BY_LABEL[label],
      tenantId: SECOND_STAGING_TENANT.id,
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
