import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";

import { getSettingsResourcesRepository } from "./create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "./seed-operator-smoke-catalog";
import { seedOperatorSmokePublishedTour } from "./seed-operator-smoke-published-tour";
import { runWithTenantContext } from "../tenant/tenant-request-context";

/**
 * Dev/VPS Prisma bootstrap — Denali dev tenant gets smoke catalog + published tour …0210.
 * Mirrors in-memory `ensureOperatorSmokeSeedTour` + `seedOperatorSmokeCatalog` for tenant …000003.
 */
export async function bootstrapDenaliDevSmokeFixturesIfNeeded(): Promise<void> {
  if (isProductionAuthMode()) {
    return;
  }
  if (process.env.STORAGE_DRIVER !== "prisma") {
    return;
  }

  const tenantId = DENALI_SMOKE_TENANT_ID;

  try {
    await runWithTenantContext(tenantId, async () => {
      const repo = getSettingsResourcesRepository();
      await seedOperatorSmokeCatalog(repo, { tenantId });
      await seedOperatorSmokePublishedTour(tenantId);
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
