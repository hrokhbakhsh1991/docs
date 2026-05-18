import { parseTenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/parse-tenant-wizard-template";
import type { TenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/tenant-wizard-template.types";

export async function fetchWorkspaceTourWizardTemplate(): Promise<TenantWizardTemplateEnvelope> {
  const res = await fetch("/api/settings/tour-wizard-template", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load tour wizard template (${res.status})`);
  }
  const json: unknown = await res.json();
  return parseTenantWizardTemplateEnvelope(json);
}
