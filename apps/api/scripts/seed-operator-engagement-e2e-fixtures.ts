/**
 * MEG-001 — idempotent Denali operator engagement smoke fixtures.
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { ProvisioningService } from "../src/internal/provisioning.service";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";
import { createPrismaEngagementRepository } from "../src/workspace-engagement/infrastructure/prisma-engagement.repository";

import {
  DENALI_DEV_OWNER_USER_ID,
  seedDenaliOperatorIdentity,
} from "./seed-denali-operator-identity";

export const DENALI_ENGAGEMENT_VIEWER_USER_ID = "00000000-0000-4000-8000-000000000196" as const;
export const DENALI_ENGAGEMENT_VIEWER_MOBILE = "+15550001996" as const;
const WORKSPACE_ID = "denali";

async function seedViewerIdentity(): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.user.upsert({
    where: { id: DENALI_ENGAGEMENT_VIEWER_USER_ID },
    create: {
      id: DENALI_ENGAGEMENT_VIEWER_USER_ID,
      mobile: DENALI_ENGAGEMENT_VIEWER_MOBILE,
    },
    update: {
      mobile: DENALI_ENGAGEMENT_VIEWER_MOBILE,
    },
  });

  await withTenantRls(DENALI_SMOKE_TENANT_ID, (tx) =>
    tx.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: DENALI_ENGAGEMENT_VIEWER_USER_ID,
          tenantId: DENALI_SMOKE_TENANT_ID,
        },
      },
      create: {
        userId: DENALI_ENGAGEMENT_VIEWER_USER_ID,
        tenantId: DENALI_SMOKE_TENANT_ID,
        role: "viewer",
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: "ws-denali-dev",
      },
      update: {
        role: "viewer",
        status: "ACTIVE",
      },
    }),
  );
}

async function seedEngagementEvents(): Promise<void> {
  const repo = createPrismaEngagementRepository();
  await runWithTenantContext(DENALI_SMOKE_TENANT_ID, () =>
    repo.awardPoints({
      tenantId: DENALI_SMOKE_TENANT_ID,
      workspaceId: WORKSPACE_ID,
      userId: DENALI_DEV_OWNER_USER_ID,
      pointsDelta: 50,
      sourceModule: "identity",
      sourceEventType: "profile.completed",
      dedupeKey: "engagement:e2e:denali-owner-profile",
      reason: "Operator engagement smoke seed",
    }),
  );
}

async function main(): Promise<void> {
  const row = await new ProvisioningService().seedDenaliSmokeTenant();
  await seedWorkspaceWizardTemplateForTenant(row.id);
  await seedDenaliOperatorIdentity();
  await seedViewerIdentity();
  await seedEngagementEvents();
  console.log(
    JSON.stringify({
      tenantId: DENALI_SMOKE_TENANT_ID,
      ownerUserId: DENALI_DEV_OWNER_USER_ID,
      viewerUserId: DENALI_ENGAGEMENT_VIEWER_USER_ID,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
