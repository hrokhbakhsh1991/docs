/**
 * Phase 11.0 — idempotent operator smoke tenant + identity + wizard template for Playwright.
 *
 * Keep the tenant seed and membership seed on the same operator-smoke binding. The generic
 * Denali dev tenant is `…003`, while the operator panel fixture is `…014`; mixing them causes
 * a foreign-key failure when the membership is inserted.
 */
import { ProvisioningService } from "../src/internal/provisioning.service";
import { seedWorkspaceWizardTemplateForTenant } from "../src/settings/seed-workspace-wizard-template";

import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";
import { seedOperatorSmokeIdentity } from "./seed-operator-smoke-identity-staging";

async function main(): Promise<void> {
  const provisioning = new ProvisioningService();
  const denali = await provisioning.seedDenaliSmokeTenant();
  const operator = await provisioning.seedOperatorSmokeTenant();
  await seedDenaliOperatorIdentity();
  await seedOperatorSmokeIdentity();
  await seedWorkspaceWizardTemplateForTenant(denali.id);
  await seedWorkspaceWizardTemplateForTenant(operator.id);
  console.log(JSON.stringify({ denali, operator }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
