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
    tx.userTenant.upsert({
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
    })
  );

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
