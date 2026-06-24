/**
 * Idempotent Denali dev reference catalog for VPS staging tenant …000003.
 * Required when automated probe uses `denali.admin.localhost` (not operator …014).
 *
 * Run on VPS:
 *   NODE_ENV=development pnpm exec tsx scripts/seed-denali-dev-catalog-staging.ts
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository.ts";
import { seedOperatorSmokeCatalog } from "../src/settings/seed-operator-smoke-catalog.ts";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template.ts";

export async function seedDenaliDevCatalogStaging(): Promise<void> {
  await seedWorkspaceWizardTemplateForTenant(DENALI_SMOKE_TENANT_ID);
  await seedOperatorSmokeCatalog(getSettingsResourcesRepository(), {
    tenantId: DENALI_SMOKE_TENANT_ID,
  });
}

async function main(): Promise<void> {
  await seedDenaliDevCatalogStaging();
  console.log("DENALI_DEV_CATALOG_SEED_OK", DENALI_SMOKE_TENANT_ID);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
