import { isTourFormProfile, normalizeTourFormProfileInput } from "@repo/types";

import type { TenantWizardTemplate, TenantWizardTemplateEnvelope } from "./tenant-wizard-template.types";
import { parseTenantWizardStepOverrides } from "./compose-wizard-steps";

export function parseTenantWizardTemplate(raw: unknown): TenantWizardTemplate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const workspaceId = typeof o.workspaceId === "string" ? o.workspaceId.trim() : "";
  if (!id || !workspaceId) {
    return null;
  }
  const baseProfile = isTourFormProfile(o.baseProfile)
    ? normalizeTourFormProfileInput(o.baseProfile)
    : "general";
  return {
    id,
    workspaceId,
    baseProfile,
    stepOverrides: parseTenantWizardStepOverrides(o.stepOverrides),
    fieldRulesOverlay:
      o.fieldRulesOverlay && typeof o.fieldRulesOverlay === "object" && !Array.isArray(o.fieldRulesOverlay)
        ? (o.fieldRulesOverlay as Record<string, unknown>)
        : {},
    presetId: typeof o.presetId === "string" && o.presetId.trim() !== "" ? o.presetId.trim() : null,
    canonicalData:
      o.canonicalData && typeof o.canonicalData === "object" && !Array.isArray(o.canonicalData)
        ? (o.canonicalData as Record<string, unknown>)
        : {},
    wizardContractVersion:
      typeof o.wizardContractVersion === "number" && Number.isFinite(o.wizardContractVersion)
        ? o.wizardContractVersion
        : 1,
    formProfileVersion:
      typeof o.formProfileVersion === "number" && Number.isFinite(o.formProfileVersion)
        ? o.formProfileVersion
        : 1,
  };
}

export function parseTenantWizardTemplateEnvelope(raw: unknown): TenantWizardTemplateEnvelope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { template: null };
  }
  const templateRaw = (raw as Record<string, unknown>).template;
  if (templateRaw == null) {
    return { template: null };
  }
  return { template: parseTenantWizardTemplate(templateRaw) };
}
