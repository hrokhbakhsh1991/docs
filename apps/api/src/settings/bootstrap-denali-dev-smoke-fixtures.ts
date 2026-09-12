import { DENALI_SMOKE_TENANT_ID } from "./resolve-workspace-dev-smoke-tenant";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert";

import { getSettingsResourcesRepository } from "./create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "./seed-operator-smoke-catalog";
import {
  ensureOperatorSmokePublishedTourEditReady,
  seedDenaliBookingScenarioTours,
  seedDenaliClubDevDraftTour,
  seedOperatorSmokePublishedTour,
} from "./seed-operator-smoke-published-tour";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { createTourStorageRepository } from "../storage/create-tour-storage";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";

const DENALI_DEV_BOOKING_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const DENALI_DEV_BOOKING_MEMBER_MOBILE = "+15550001003";
const DENALI_DEV_BOOKING_MEMBER_WORKSPACE_ID = "ws-denali-dev-member";

async function ensureDenaliDevBookingMember(): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.user.upsert({
    where: { id: DENALI_DEV_BOOKING_MEMBER_USER_ID },
    create: {
      id: DENALI_DEV_BOOKING_MEMBER_USER_ID,
      mobile: DENALI_DEV_BOOKING_MEMBER_MOBILE,
    },
    update: { mobile: DENALI_DEV_BOOKING_MEMBER_MOBILE },
  });
  await withTenantRls(DENALI_SMOKE_TENANT_ID, (tx) =>
    tx.userTenant.upsert({
      where: {
        userId_tenantId: {
          userId: DENALI_DEV_BOOKING_MEMBER_USER_ID,
          tenantId: DENALI_SMOKE_TENANT_ID,
        },
      },
      create: {
        userId: DENALI_DEV_BOOKING_MEMBER_USER_ID,
        tenantId: DENALI_SMOKE_TENANT_ID,
        role: "member",
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: DENALI_DEV_BOOKING_MEMBER_WORKSPACE_ID,
        membershipMetadata: {
          displayName: "Smoke Member",
          rewards: { permanentDiscountPercentage: 20 },
        },
      },
      update: {
        role: "member",
        status: "ACTIVE",
        workspaceId: DENALI_DEV_BOOKING_MEMBER_WORKSPACE_ID,
        membershipMetadata: {
          displayName: "Smoke Member",
          rewards: { permanentDiscountPercentage: 20 },
        },
      },
    })
  );
}

/**
 * Dev bootstrap — Denali dev tenant gets smoke catalog + published/draft tours (ED-SEED-01).
 * Runs for memory (local dev) and prisma (VPS) when not in production auth mode.
 */
export async function bootstrapDenaliDevSmokeFixturesIfNeeded(): Promise<void> {
  if (isProductionAuthMode()) {
    return;
  }

  const tenantId = DENALI_SMOKE_TENANT_ID;

  try {
    await runWithTenantContext(
      tenantId,
      async () => {
        const repo = getSettingsResourcesRepository();
        await seedOperatorSmokeCatalog(repo, { tenantId });

        if (resolveStorageDriver() === "prisma") {
          await ensureDenaliDevBookingMember();
          await seedOperatorSmokePublishedTour(tenantId);
          await ensureOperatorSmokePublishedTourEditReady(tenantId);
          await seedDenaliClubDevDraftTour(tenantId);
          await seedDenaliBookingScenarioTours(tenantId);
        } else {
          const tourStore = createTourStorageRepository();
          if (tourStore instanceof InMemoryTourRepository) {
            tourStore.ensureDenaliDevSmokeSeedTour();
          }
        }
      },
      { workspaceType: "denali", tenantTier: "pool" }
    );
    logger.info(
      { event: "settings.denali_dev_smoke.bootstrapped", tenantId },
      "denali dev smoke catalog and published tour seeded"
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      { event: "settings.denali_dev_smoke.bootstrap_failed", tenantId, error: message },
      "denali dev smoke bootstrap skipped"
    );
  }
}
