import { getPrismaAdmin } from "../src/db/prisma";
import { Prisma } from "@prisma/client";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { resolveLoginMobileLookupKeys } from "../src/identity/canonicalize-login-mobile";
import {
  assertStagingIdentityTenantExclusive,
  canDeleteStagingIdentityUsers,
  planSecondStagingIdentityWrites,
  resolveFirstStagingIdentityFixtures,
  FIRST_STAGING_TENANT,
} from "./lib/denali-second-staging-fixtures";
import { assertSecondTenantStagingTarget } from "./lib/denali-second-staging-target";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.length > 1) {
    throw new Error("Usage: cleanup-denali-first-staging-identities.ts [--apply]");
  }
  const apply = args.includes("--apply");
  assertSecondTenantStagingTarget(process.env, apply, "aIdentitiesCleanup");
  const fixtures = resolveFirstStagingIdentityFixtures(process.env);
  const prisma = getPrismaAdmin();

  const usersById = await Promise.all(
    fixtures.map((fixture) =>
      prisma.user.findUnique({ where: { id: fixture.userId }, select: { id: true, mobile: true } })
    )
  );
  const usersByMobile = await Promise.all(
    fixtures.map((fixture) =>
      prisma.user.findMany({
        where: { mobile: { in: [...resolveLoginMobileLookupKeys(fixture.mobile)] } },
        select: { id: true, mobile: true },
      })
    )
  );
  const memberships = await withTenantRls(FIRST_STAGING_TENANT.id, (tx) =>
    Promise.all(
      fixtures.map((fixture) =>
        tx.userTenant.findUnique({
          where: { userId_tenantId: { userId: fixture.userId, tenantId: FIRST_STAGING_TENANT.id } },
          select: {
            userId: true,
            tenantId: true,
            role: true,
            status: true,
            sessionVersion: true,
            workspaceId: true,
            membershipMetadata: true,
          },
        })
      )
    )
  );
  const tenantMemberships = await prisma.userTenant.findMany({
    where: { userId: { in: fixtures.map((fixture) => fixture.userId) } },
    select: { userId: true, tenantId: true },
  });
  assertStagingIdentityTenantExclusive(fixtures, tenantMemberships);
  planSecondStagingIdentityWrites(fixtures, usersById, usersByMobile, memberships);
  const otpChallenges = await prisma.mobileOtpChallenge.findMany({
    where: { mobile: { in: fixtures.map((fixture) => fixture.mobile) } },
    select: { mobile: true },
  });
  const ownedMobiles = new Set(
    fixtures.filter((fixture, index) => usersById[index] !== null).map((fixture) => fixture.mobile)
  );
  if (otpChallenges.some((challenge) => !ownedMobiles.has(challenge.mobile))) {
    throw new Error("DENALI_FIRST_STAGING_IDENTITY_OTP_COLLISION");
  }
  const userReferences = await countUserReferences(
    prisma,
    fixtures.map((fixture) => fixture.userId)
  );

  if (!apply) {
    console.log(
      `DENALI_FIRST_STAGING_IDENTITIES_CLEANUP_DRY_RUN_OK tenantId=${FIRST_STAGING_TENANT.id} memberships=${memberships.filter((membership) => membership !== null).length} users=${usersById.filter((user) => user !== null).length} userReferences=${userReferences} otpChallenges=${otpChallenges.length}`
    );
    return;
  }

  const existingIds = fixtures.filter((fixture, index) => usersById[index] !== null);
  if (existingIds.length > 0) {
    await withTenantRls(FIRST_STAGING_TENANT.id, (tx) =>
      tx.userTenant.deleteMany({
        where: {
          tenantId: FIRST_STAGING_TENANT.id,
          userId: { in: existingIds.map((fixture) => fixture.userId) },
        },
      })
    );
  }

  const remainingMemberships = await prisma.userTenant.findMany({
    where: { userId: { in: fixtures.map((fixture) => fixture.userId) } },
    select: { userId: true, tenantId: true },
  });
  if (remainingMemberships.length !== 0) {
    throw new Error("DENALI_FIRST_STAGING_IDENTITY_MEMBERSHIP_REMAINS");
  }

  const remainingUserReferences = await countUserReferences(
    prisma,
    fixtures.map((fixture) => fixture.userId)
  );
  const deleteUsers = canDeleteStagingIdentityUsers(remainingUserReferences);
  let deletedUsers = 0;
  if (deleteUsers) {
    const deleted = await prisma.user.deleteMany({
      where: {
        OR: fixtures.map((fixture) => ({ id: fixture.userId, mobile: fixture.mobile })),
      },
    });
    deletedUsers = deleted.count;
    const remainingUsers = await prisma.user.findMany({
      where: {
        OR: fixtures.flatMap((fixture) => [{ id: fixture.userId }, { mobile: fixture.mobile }]),
      },
      select: { id: true },
    });
    if (remainingUsers.length !== 0) {
      throw new Error("DENALI_FIRST_STAGING_IDENTITY_USER_REMAINS");
    }
  }
  const deletedChallenges = await prisma.mobileOtpChallenge.deleteMany({
    where: { mobile: { in: fixtures.map((fixture) => fixture.mobile) } },
  });
  console.log(
    `DENALI_FIRST_STAGING_IDENTITIES_CLEANUP_OK tenantId=${FIRST_STAGING_TENANT.id} deletedUsers=${deletedUsers} preservedUsers=${deleteUsers ? 0 : existingIds.length} userReferences=${remainingUserReferences} deletedChallenges=${deletedChallenges.count}`
  );
}

async function countUserReferences(
  prisma: ReturnType<typeof getPrismaAdmin>,
  userIds: readonly string[]
): Promise<number> {
  const models = Prisma.dmmf.datamodel.models;
  let total = 0;
  for (const model of models) {
    if (model.name === "UserTenant") continue;
    const userFields = model.fields.filter(
      (field) => field.kind === "scalar" && field.type === "String" && /userId$/i.test(field.name)
    );
    if (userFields.length === 0) continue;

    const delegateName = `${model.name[0]?.toLowerCase() ?? ""}${model.name.slice(1)}`;
    const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as
      | { count: (args: { where: Record<string, unknown> }) => Promise<number> }
      | undefined;
    if (!delegate || typeof delegate.count !== "function") {
      throw new Error("DENALI_FIRST_STAGING_IDENTITY_REFERENCE_SCAN_UNAVAILABLE");
    }
    for (const field of userFields) {
      total += await delegate.count({ where: { [field.name]: { in: [...userIds] } } });
    }
  }
  return total;
}

main().catch((error: unknown) => {
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : undefined;
  console.error(safeMessage ?? "DENALI_FIRST_STAGING_IDENTITIES_CLEANUP_FAILED");
  process.exitCode = 1;
});
