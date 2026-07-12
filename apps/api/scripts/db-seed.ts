/**
 * Phase 4.3 — idempotent dev tenant seed (`tenant-a`, `tenant-b`).
 *
 * Run: NODE_ENV=development DATABASE_URL=... DATABASE_URL_ADMIN=... pnpm --filter @apps/api run db:seed
 */
import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { ProvisioningService } from "../src/internal/provisioning.service";
import { logger } from "../src/observability/logger";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository";
import { seedOperatorSmokeCatalog } from "../src/settings/seed-operator-smoke-catalog";
import {
  seedDenaliClubDevPublishedTour,
  seedOperatorSmokeParticipantRequirementsTour,
  seedOperatorSmokePublishedTour,
  seedOperatorSmokeTransportTours,
} from "../src/settings/seed-operator-smoke-published-tour";
import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";

async function main(): Promise<void> {
  const service = new ProvisioningService();
  const tenants = await service.seedDevTenants();
  for (const tenant of tenants) {
    logger.info({ event: "db.seed.tenant", subdomain: tenant.subdomain }, "dev tenant seeded");
  }
  const denali = await service.seedDenaliSmokeTenant();
  logger.info({ event: "db.seed.tenant", subdomain: denali.subdomain }, "dev tenant seeded");
  await seedWorkspaceWizardTemplateForTenant(denali.id);
  logger.info({ event: "db.seed.denali_wizard_template", tenantId: denali.id }, "denali wizard template seeded");
  await seedOperatorSmokeCatalog(getSettingsResourcesRepository(), { tenantId: DENALI_SMOKE_TENANT_ID });
  await seedDenaliClubDevPublishedTour(DENALI_SMOKE_TENANT_ID);
  logger.info(
    { event: "db.seed.denali_dev_smoke_catalog", tenantId: DENALI_SMOKE_TENANT_ID },
    "denali dev smoke catalog and published tour seeded"
  );
  const urban = await service.seedUrbanSmokeTenant();
  logger.info({ event: "db.seed.tenant", subdomain: urban.subdomain }, "dev tenant seeded");
  await seedWorkspaceWizardTemplateForTenant(urban.id);
  logger.info({ event: "db.seed.urban_wizard_template", tenantId: urban.id }, "urban wizard template seeded");
  const operator = await service.seedOperatorSmokeTenant();
  logger.info({ event: "db.seed.tenant", subdomain: operator.subdomain }, "operator smoke tenant seeded");
  await seedWorkspaceWizardTemplateForTenant(operator.id);
  await seedOperatorSmokeCatalog(getSettingsResourcesRepository());
  await seedOperatorSmokePublishedTour(operator.id);
  await seedOperatorSmokeParticipantRequirementsTour(operator.id);
  await seedOperatorSmokeTransportTours(operator.id);
  logger.info(
    { event: "db.seed.operator_smoke_catalog", tenantId: operator.id },
    "operator smoke reference catalog seeded"
  );
  await seedDenaliOperatorIdentity();
  const { seedPlatformPlans } = await import("./seed-platform-plans.ts");
  await seedPlatformPlans();
  const { seedWorkspaceDefinitionsFromDir } = await import("./seed-workspace-definitions.ts");
  const definitions = await seedWorkspaceDefinitionsFromDir();
  for (const row of definitions) {
    logger.info(
      {
        event: "db.seed.workspace_definition",
        definitionId: row.definitionId,
        version: row.version,
      },
      "workspace definition seeded"
    );
  }
}

main().catch((error: unknown) => {
  logger.error(
    {
      event: "db.seed.failed",
      code: "SEED_DEV_TENANTS_FAILED",
      err: error instanceof Error ? error.message : String(error),
    },
    "dev tenant seed failed"
  );
  process.exit(1);
});
