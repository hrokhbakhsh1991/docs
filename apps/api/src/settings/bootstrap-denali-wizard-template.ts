import { DENALI_SMOKE_TENANT_ID } from "@app-tour/workspace-denali";

import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { logger } from "../observability/logger";

import { seedDenaliFullWizardTemplate } from "./seed-denali-full-wizard-template";

const DEV_DENALI_TENANT_IDS = [
  DENALI_SMOKE_TENANT_ID,
  "00000000-0000-4000-8000-000000000014",
] as const;

/** Idempotent dev bootstrap — memory driver and fresh dev DB get a published full template. */
export async function bootstrapDenaliWizardTemplatesIfNeeded(): Promise<void> {
  if (isProductionAuthMode()) {
    return;
  }

  for (const tenantId of DEV_DENALI_TENANT_IDS) {
    try {
      await seedDenaliFullWizardTemplate(tenantId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        { event: "settings.wizard_template.bootstrap_failed", tenantId, error: message },
        "denali wizard template bootstrap skipped for tenant"
      );
    }
  }
}
