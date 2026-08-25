/**
 * Idempotent operator smoke seed for VPS staging (tour_db_staging).
 * Skips full db-seed.ts (urban wizard template can fail on mixed prod/dist bindings).
 *
 * Run on VPS:
 *   NODE_ENV=development pnpm exec tsx scripts/seed-operator-staging.ts
 */
import { ProvisioningService } from "../src/internal/provisioning.service.ts";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository.ts";
import { seedOperatorSmokeCatalog } from "../src/settings/seed-operator-smoke-catalog.ts";
import { seedOperatorSmokePublishedTour, ensureOperatorSmokePublishedTourPolicies, seedOperatorSmokeDraftTour } from "../src/settings/seed-operator-smoke-published-tour.ts";
import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity.ts";
import { seedDenaliDevCatalogStaging } from "./seed-denali-dev-catalog-staging.ts";
import { seedOperatorSmokeIdentity } from "./seed-operator-smoke-identity-staging.ts";

async function main(): Promise<void> {
  const service = new ProvisioningService();
  await service.seedDenaliSmokeTenant();
  const operator = await service.seedOperatorSmokeTenant();
  await seedOperatorSmokeCatalog(getSettingsResourcesRepository());
  await seedOperatorSmokePublishedTour(operator.id);
  await ensureOperatorSmokePublishedTourPolicies(operator.id);
  await seedOperatorSmokeDraftTour(operator.id);
  await seedDenaliOperatorIdentity();
  await seedOperatorSmokeIdentity();
  await seedDenaliDevCatalogStaging();
  console.log("OPERATOR_STAGING_SEED_OK", operator.id);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
