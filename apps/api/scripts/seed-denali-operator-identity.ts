/**
 * Idempotent Denali dev operator identity — mirrors in-memory `seedOperatorSmokeDevFixture`.
 * Required when STORAGE_DRIVER=prisma (Postgres is SoT for identity).
 *
 * @see docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md § Dev bootstrap checklist
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { logger } from "../src/observability/logger";

export const DENALI_DEV_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101" as const;
export const DENALI_DEV_OWNER_MOBILE = "+15550001001" as const;
export const DENALI_DEV_WORKSPACE_ID = "ws-denali-dev" as const;

function resolveOperatorOwnerSeed(): {
  readonly userId: string;
  readonly mobile: string;
  readonly displayName?: string;
} {
  const mobile = process.env.OPERATOR_OWNER_MOBILE?.trim() || DENALI_DEV_OWNER_MOBILE;
  const userId = process.env.OPERATOR_OWNER_USER_ID?.trim() || DENALI_DEV_OWNER_USER_ID;
  const displayName = process.env.OPERATOR_OWNER_DISPLAY_NAME?.trim();
  return {
    userId,
    mobile,
    ...(displayName !== undefined && displayName.length > 0 ? { displayName } : {}),
  };
}

export async function seedDenaliOperatorIdentity(): Promise<void> {
  const prisma = getPrismaAdmin();
  const owner = resolveOperatorOwnerSeed();
  const membershipMetadata =
    owner.displayName !== undefined ? { displayName: owner.displayName } : {};

  await prisma.user.upsert({
    where: { mobile: owner.mobile },
    create: {
      id: owner.userId,
      mobile: owner.mobile,
    },
    update: {},
  });

  await withTenantRls(DENALI_SMOKE_TENANT_ID, (tx) =>
    tx.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: owner.userId,
          tenantId: DENALI_SMOKE_TENANT_ID,
        },
      },
      create: {
        userId: owner.userId,
        tenantId: DENALI_SMOKE_TENANT_ID,
        role: "owner",
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: DENALI_DEV_WORKSPACE_ID,
        membershipMetadata,
      },
      update: {
        role: "owner",
        status: "ACTIVE",
        workspaceId: DENALI_DEV_WORKSPACE_ID,
        membershipMetadata,
      },
    })
  );

  logger.info(
    {
      event: "db.seed.denali_operator_identity",
      tenantId: DENALI_SMOKE_TENANT_ID,
      mobile: owner.mobile,
      displayName: owner.displayName,
    },
    "denali operator identity seeded"
  );
}
