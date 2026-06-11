import {
  buildDenaliFullWizardTemplatePayload,
  DENALI_SMOKE_TENANT_ID,
} from "@app-tour/workspace-denali";

import { getSettingsConfigRepository } from "./create-settings-config-repository";

/** Idempotent — seeds published full Denali wizard template for dev/smoke tenant. */
export async function seedDenaliFullWizardTemplate(
  tenantId: string = DENALI_SMOKE_TENANT_ID
): Promise<void> {
  const repo = getSettingsConfigRepository();
  const existing = await repo.get(tenantId, "wizard_template");
  if (existing != null) {
    const payload = existing.payload as { published?: boolean; steps?: unknown[] };
    if (payload.published === true && Array.isArray(payload.steps) && payload.steps.length > 5) {
      return;
    }
  }

  const payload = buildDenaliFullWizardTemplatePayload();
  await repo.seed({
    tenantId,
    configKey: "wizard_template",
    configVersion: 1,
    payload,
    updatedAt: new Date().toISOString(),
  });
}
