import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { resolveLoginMobileLookupKeys } from "../src/identity/canonicalize-login-mobile";
import { assertSecondStagingIdentityLoginPolicy } from "./lib/denali-second-staging-fixtures";
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
      `DENALI_SECOND_STAGING_IDENTITIES_DRY_RUN_OK tenantId=${SECOND_STAGING_TENANT.id} identities=${fixtures.length} roles=owner,admin,member`
    );
    return;
  }
  assertSecondStagingIdentityLoginPolicy(process.env);

  const prisma = getPrismaAdmin();
  const tenant = await prisma.tenant.findUnique({
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
      prisma.user.findUnique({
        where: { id: fixture.userId },
        select: { id: true, mobile: true },
      })
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
  const memberships = await withTenantRls(SECOND_STAGING_TENANT.id, (tx) =>
    Promise.all(
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
    )
  );
  const plan = planSecondStagingIdentityWrites(fixtures, usersById, usersByMobile, memberships);

  if (plan.usersToCreate.length > 0) {
    await prisma.user.createMany({
      data: plan.usersToCreate.map(({ userId, mobile }) => ({ id: userId, mobile })),
    });
  }
  if (plan.membershipsToCreate.length > 0) {
    await withTenantRls(SECOND_STAGING_TENANT.id, (tx) =>
      tx.userTenant.createMany({
        data: plan.membershipsToCreate.map((fixture) => ({
          userId: fixture.userId,
          tenantId: fixture.tenantId,
          role: fixture.role,
          status: "ACTIVE",
          sessionVersion: 1,
          workspaceId: fixture.workspaceId,
          membershipMetadata: { displayName: fixture.displayName },
        })),
      })
    );
  }

  const finalMemberships = await withTenantRls(SECOND_STAGING_TENANT.id, (tx) =>
    Promise.all(
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
    )
  );
  const finalUsersById = await Promise.all(
    fixtures.map((fixture) =>
      prisma.user.findUnique({
        where: { id: fixture.userId },
        select: { id: true, mobile: true },
      })
    )
  );
  const finalUsersByMobile = await Promise.all(
    fixtures.map((fixture) =>
      prisma.user.findMany({
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
