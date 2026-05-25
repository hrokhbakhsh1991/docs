import { parseTenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/parse-tenant-wizard-template";
import type { TenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";

export type UpdateWorkspaceTourWizardTemplatePayload = {
  fieldRulesOverlay?: Record<string, unknown>;
  canonicalData?: Record<string, unknown>;
  publish?: boolean;
};

export async function fetchWorkspaceTourWizardTemplate(): Promise<TenantWizardTemplateEnvelope> {
  const json = await bffBrowserClient.get<unknown>("/api/settings/tour-wizard-template");
  return parseTenantWizardTemplateEnvelope(json);
}

export async function updateWorkspaceTourWizardTemplate(
  payload: UpdateWorkspaceTourWizardTemplatePayload,
): Promise<TenantWizardTemplateEnvelope> {
  const json = await bffBrowserClient.patch<unknown>("/api/settings/tour-wizard-template", payload);
  return parseTenantWizardTemplateEnvelope(json);
}
