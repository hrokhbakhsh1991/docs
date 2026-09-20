/**
 * P7-2-N-001 — operator smoke owner on tenant …014 (Postgres identity SoT).
 * Enables operator.admin.localhost OTP login for workspace probes.
 */
import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { logger } from "../src/observability/logger";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant.ts";

import { resolveOperatorSmokeOwnerSeedMobile } from "./resolve-operator-owner-seed-mobile.ts";

const OPERATOR_SMOKE_WORKSPACE_ID = "ws-operator-smoke" as const;
const OPERATOR_SMOKE_INVITEE_MOBILE = "+15550008803" as const;
const OPERATOR_SMOKE_INVITEE_USER_ID = "00000000-0000-4000-8000-000000000195" as const;

const OPERATOR_SMOKE_TEAM = [
  {
    userId: "00000000-0000-4000-8000-000000000102" as const,
    mobile: "+15550001002" as const,
    role: "admin" as const,
    workspaceId: "ws-operator-smoke-admin" as const,
    displayName: "Smoke Admin" as const,
  },
  {
    userId: "00000000-0000-4000-8000-000000000103" as const,
    mobile: "+15550001003" as const,
    role: "member" as const,
    workspaceId: "ws-operator-smoke-member" as const,
    displayName: "Smoke Member" as const,
  },
] as const;

export async function seedOperatorSmokeIdentity(): Promise<void> {
  const prisma = getPrismaAdmin();
  const ownerMobile = resolveOperatorSmokeOwnerSeedMobile();

  await prisma.user.upsert({
    where: { id: OPERATOR_SMOKE.ownerUserId },
    create: {
      id: OPERATOR_SMOKE.ownerUserId,
      mobile: ownerMobile,
    },
    update: {
      mobile: ownerMobile,
    },
  });

  await withTenantRls(OPERATOR_SMOKE.tenantId, (tx) =>
    (async () => {
      await tx.userTenant.upsert({
        where: {
          userId_tenantId: {
            userId: OPERATOR_SMOKE.ownerUserId,
            tenantId: OPERATOR_SMOKE.tenantId,
          },
        },
        create: {
          userId: OPERATOR_SMOKE.ownerUserId,
          tenantId: OPERATOR_SMOKE.tenantId,
          role: "owner",
          status: "ACTIVE",
          sessionVersion: 1,
          workspaceId: OPERATOR_SMOKE_WORKSPACE_ID,
        },
        update: {
          role: "owner",
          status: "ACTIVE",
          workspaceId: OPERATOR_SMOKE_WORKSPACE_ID,
        },
      });

  for (const member of OPERATOR_SMOKE_TEAM) {
        await prisma.user.upsert({
          where: { id: member.userId },
          create: { id: member.userId, mobile: member.mobile },
          update: { mobile: member.mobile },
        });
        await tx.userTenant.upsert({
          where: {
            userId_tenantId: {
              userId: member.userId,
              tenantId: OPERATOR_SMOKE.tenantId,
            },
          },
          create: {
            userId: member.userId,
            tenantId: OPERATOR_SMOKE.tenantId,
            role: member.role,
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: member.workspaceId,
            membershipMetadata: { displayName: member.displayName },
          },
          update: {
            role: member.role,
            status: "ACTIVE",
            workspaceId: member.workspaceId,
            membershipMetadata: { displayName: member.displayName },
          },
        });
      }
    })()
  );

  await prisma.user.upsert({
    where: { id: OPERATOR_SMOKE_INVITEE_USER_ID },
    create: { id: OPERATOR_SMOKE_INVITEE_USER_ID, mobile: OPERATOR_SMOKE_INVITEE_MOBILE },
    update: { mobile: OPERATOR_SMOKE_INVITEE_MOBILE },
  });

  // The invite flow must start with this reserved user outside the workspace;
  // otherwise a previous accepted run is correctly filtered from pending.
  await prisma.userTenant.deleteMany({
    where: {
      tenantId: OPERATOR_SMOKE.tenantId,
      userId: OPERATOR_SMOKE_INVITEE_USER_ID,
    },
  });

  // Reset only the reserved smoke invite so repeated browser runs start from a
  // known pending-invite state without touching real workspace invitations.
  await prisma.operatorPendingInvite.deleteMany({
    where: {
      tenantId: OPERATOR_SMOKE.tenantId,
      phone: OPERATOR_SMOKE_INVITEE_MOBILE,
    },
  });

  logger.info(
    {
      event: "db.seed.operator_smoke_identity",
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: ownerMobile,
    },
    "operator smoke owner identity seeded"
  );
}

async function main(): Promise<void> {
  await seedOperatorSmokeIdentity();
  console.log("OPERATOR_SMOKE_IDENTITY_SEED_OK", OPERATOR_SMOKE.tenantId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
