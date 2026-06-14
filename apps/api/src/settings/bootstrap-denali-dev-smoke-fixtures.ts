import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert";

import { getSettingsResourcesRepository } from "./create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "./seed-operator-smoke-catalog";
import { seedOperatorSmokePublishedTour } from "./seed-operator-smoke-published-tour";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { createTourStorageRepository } from "../storage/create-tour-storage";
import { runWithTenantContext } from "../tenant/tenant-request-context";

/**
 * Dev bootstrap — Denali dev tenant gets smoke catalog + published tour …0210.
 * Runs for memory (local dev) and prisma (VPS) when not in production auth mode.
 */
export async function bootstrapDenaliDevSmokeFixturesIfNeeded(): Promise<void> {
  if (isProductionAuthMode()) {
    return;
  }

  const tenantId = DENALI_SMOKE_TENANT_ID;

  try {
    await runWithTenantContext(tenantId, async () => {
      const repo = getSettingsResourcesRepository();
      await seedOperatorSmokeCatalog(repo, { tenantId });

      if (resolveStorageDriver() === "prisma") {
        await seedOperatorSmokePublishedTour(tenantId);
      } else {
        const tourStore = createTourStorageRepository();
        if (tourStore instanceof InMemoryTourRepository) {
          tourStore.ensureDenaliDevSmokeSeedTour();
        }
      }
    });
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
