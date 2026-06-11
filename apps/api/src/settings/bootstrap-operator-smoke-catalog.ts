import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";

import { getSettingsResourcesRepository } from "./create-settings-resources-repository";
import { OPERATOR_SMOKE_TENANT_ID, seedOperatorSmokeCatalog } from "./seed-operator-smoke-catalog";

/** Dev/memory operator smoke — non-empty equipment/locations/themes for wizard + SMK-P9-08. */
export async function bootstrapOperatorSmokeCatalogIfNeeded(): Promise<void> {
  if (isProductionAuthMode()) {
    return;
  }
  if (process.env.OPERATOR_SMOKE_E2E_SEED !== "1") {
    return;
  }

  try {
    const repo = getSettingsResourcesRepository();
    await seedOperatorSmokeCatalog(repo);
    logger.info(
      { event: "settings.operator_smoke_catalog.bootstrapped", tenantId: OPERATOR_SMOKE_TENANT_ID },
      "operator smoke reference catalog seeded"
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      { event: "settings.operator_smoke_catalog.bootstrap_failed", error: message },
      "operator smoke catalog bootstrap skipped"
    );
  }
}
