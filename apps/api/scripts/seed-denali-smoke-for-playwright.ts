/**
 * Phase 6.6 — idempotent denali smoke tenant + identity + wizard template for Playwright.
 */
import { ProvisioningService } from "../src/internal/provisioning.service";
import { seedDenaliFullWizardTemplate } from "../src/settings/seed-denali-full-wizard-template";

import { seedDenaliOperatorIdentity } from "./seed-denali-operator-identity";

async function main(): Promise<void> {
  const row = await new ProvisioningService().seedDenaliSmokeTenant();
  await seedDenaliOperatorIdentity();
  await seedDenaliFullWizardTemplate(row.id);
  console.log(JSON.stringify(row));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
