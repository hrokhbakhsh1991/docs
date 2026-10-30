import { getPrismaAdmin } from "../src/db/prisma";
import { applyTenantRlsSessionVars } from "../src/db/rls-session-vars";
import { resolveLoginMobileLookupKeys } from "../src/identity/canonicalize-login-mobile";
import {
  assertSecondStagingIdentityLoginPolicy,
  assertSecondStagingIdentityOtpChallengesClear,
  assertStagingIdentityTenantExclusive,
} from "./lib/denali-second-staging-fixtures";
import { assertSecondTenantStagingTarget } from "./lib/denali-second-staging-target";
import {
  planSecondStagingIdentityWrites,
  resolveSecondStagingIdentityFixtures,
  SECOND_STAGING_TENANT,
} from "./lib/denali-second-staging-fixtures";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.length > 1) {
    throw new Error("Usage: seed-denali-second-staging-identities.ts [--apply]");
  }
  const apply = args.includes("--apply");
  assertSecondTenantStagingTarget(process.env, apply, "identities");
  const fixtures = resolveSecondStagingIdentityFixtures(process.env);

  if (!apply) {
    console.log(
      `DENALI_SECOND_STAGING_IDENTITIES_DRY_RUN_OK tenantId=${SECOND_STAGING_TENANT.id} identities=${fixtures.length} roles=${fixtures.map(({ label, role }) => `${label}:${role}`).join(",")}`
    );
    return;
  }
  assertSecondStagingIdentityLoginPolicy(process.env);

  const prisma = getPrismaAdmin();
  const plan = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: SECOND_STAGING_TENANT.id },
        select: { id: true, subdomain: true, workspaceType: true, status: true },
      });
      if (
        tenant?.id !== SECOND_STAGING_TENANT.id ||
        tenant.subdomain !== SECOND_STAGING_TENANT.subdomain ||
        tenant.workspaceType !== SECOND_STAGING_TENANT.workspaceType ||
        tenant.status !== SECOND_STAGING_TENANT.status
      ) {
        throw new Error("DENALI_SECOND_STAGING_TENANT_NOT_READY");
      }

      const usersById = await Promise.all(
        fixtures.map((fixture) =>
          tx.user.findUnique({
            where: { id: fixture.userId },
            select: { id: true, mobile: true },
          })
        )
      );
      const usersByMobile = await Promise.all(
        fixtures.map((fixture) =>
          tx.user.findMany({
            where: { mobile: { in: [...resolveLoginMobileLookupKeys(fixture.mobile)] } },
            select: { id: true, mobile: true },
          })
        )
      );
      const tenantMemberships = await tx.userTenant.findMany({
        where: { userId: { in: fixtures.map((fixture) => fixture.userId) } },
        select: { userId: true, tenantId: true },
      });
      assertStagingIdentityTenantExclusive(fixtures, tenantMemberships);

      await applyTenantRlsSessionVars(tx, SECOND_STAGING_TENANT.id, undefined);
      const memberships = await Promise.all(
        fixtures.map((fixture) =>
          tx.userTenant.findUnique({
            where: {
              userId_tenantId: {
                userId: fixture.userId,
                tenantId: SECOND_STAGING_TENANT.id,
              },
            },
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
      );
      const writePlan = planSecondStagingIdentityWrites(
        fixtures,
        usersById,
        usersByMobile,
        memberships
      );
      if (writePlan.usersToCreate.length > 0 || writePlan.membershipsToCreate.length > 0) {
        const existingOtpChallenges = await tx.mobileOtpChallenge.count({
          where: { mobile: { in: fixtures.map((fixture) => fixture.mobile) } },
        });
        assertSecondStagingIdentityOtpChallengesClear(existingOtpChallenges);
      }

      for (const fixture of writePlan.usersToCreate) {
        await tx.user.create({ data: { id: fixture.userId, mobile: fixture.mobile } });
      }
      for (const fixture of writePlan.membershipsToCreate) {
        await tx.userTenant.create({
          data: {
            userId: fixture.userId,
            tenantId: fixture.tenantId,
            role: fixture.role,
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: fixture.workspaceId,
            membershipMetadata: { displayName: fixture.displayName },
          },
        });
      }

      const finalMemberships = await Promise.all(
        fixtures.map((fixture) =>
          tx.userTenant.findUnique({
            where: {
              userId_tenantId: {
                userId: fixture.userId,
                tenantId: SECOND_STAGING_TENANT.id,
              },
            },
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
      );
      const finalUsersById = await Promise.all(
        fixtures.map((fixture) =>
          tx.user.findUnique({
            where: { id: fixture.userId },
            select: { id: true, mobile: true },
          })
        )
      );
      const finalUsersByMobile = await Promise.all(
        fixtures.map((fixture) =>
          tx.user.findMany({
            where: { mobile: { in: [...resolveLoginMobileLookupKeys(fixture.mobile)] } },
            select: { id: true, mobile: true },
          })
        )
      );
      const finalPlan = planSecondStagingIdentityWrites(
        fixtures,
        finalUsersById,
        finalUsersByMobile,
        finalMemberships
      );
      if (finalPlan.usersToCreate.length > 0 || finalPlan.membershipsToCreate.length > 0) {
        throw new Error("DENALI_SECOND_STAGING_IDENTITY_VERIFY_FAILED");
      }
      return writePlan;
    },
    { isolationLevel: "Serializable" }
  );
  console.log(
    `DENALI_SECOND_STAGING_IDENTITIES_SEED_OK tenantId=${SECOND_STAGING_TENANT.id} createdUsers=${plan.usersToCreate.length} createdMemberships=${plan.membershipsToCreate.length} alreadyPresent=${plan.alreadyPresent.length}`
  );
}

main().catch((error: unknown) => {
  const safeMessage =
    error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : undefined;
  console.error(safeMessage ?? "DENALI_SECOND_STAGING_IDENTITIES_SEED_FAILED");
  process.exitCode = 1;
});
