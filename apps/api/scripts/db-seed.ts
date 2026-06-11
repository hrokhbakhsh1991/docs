/**
 * Phase 4.3 — idempotent dev tenant seed (`tenant-a`, `tenant-b`).
 *
 * Run: NODE_ENV=development DATABASE_URL=... DATABASE_URL_ADMIN=... pnpm --filter @apps/api run db:seed
 */
import { ProvisioningService } from "../src/internal/provisioning.service";
import { logger } from "../src/observability/logger";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "../src/settings/seed-operator-smoke-catalog";
import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";
import { seedDenaliFullWizardTemplate } from "../src/settings/seed-denali-full-wizard-template";

async function main(): Promise<void> {
  const service = new ProvisioningService();
  const tenants = await service.seedDevTenants();
  for (const tenant of tenants) {
    logger.info({ event: "db.seed.tenant", subdomain: tenant.subdomain }, "dev tenant seeded");
  }
  const denali = await service.seedDenaliSmokeTenant();
  logger.info({ event: "db.seed.tenant", subdomain: denali.subdomain }, "dev tenant seeded");
  await seedDenaliFullWizardTemplate(denali.id);
  logger.info({ event: "db.seed.denali_wizard_template", tenantId: denali.id }, "denali wizard template seeded");
  const operator = await service.seedOperatorSmokeTenant();
  logger.info({ event: "db.seed.tenant", subdomain: operator.subdomain }, "operator smoke tenant seeded");
  await seedDenaliFullWizardTemplate(operator.id);
  await seedOperatorSmokeCatalog(getSettingsResourcesRepository());
  logger.info(
    { event: "db.seed.operator_smoke_catalog", tenantId: operator.id },
    "operator smoke reference catalog seeded"
  );
  await seedDenaliOperatorIdentity();
}

main().catch(() => {
  logger.error(
    { event: "db.seed.failed", code: "SEED_DEV_TENANTS_FAILED" },
    "dev tenant seed failed"
  );
  process.exit(1);
});
