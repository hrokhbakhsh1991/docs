import type { TourFormProfile } from "@repo/types";

import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "./schemas/denaliCore.schema";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

import type { PresetMapperContext } from "./profiles/mapPresetToFormPatch";
import {
  orchestrateDenaliWizardFromTemplate,
  presetCanonicalDataForFactory,
  type OrchestrateDenaliWizardResult,
} from "@/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";

/** Shared input for preset apply (banner + `?presetId=` bootstrap). */
export type ApplyWizardPresetInput = {
  workspaceFormProfile: TourFormProfile;
  /** @deprecated Classic wizard roots; ignored by Denali preset apply. */
  defaults?: Record<string, unknown>;
  canonicalData?: DenaliCanonicalTemplateData;
  ctx?: PresetMapperContext;
  themeCatalog?: SettingsTourThemeDto[];
};

export type ApplyDenaliWizardPresetInput = ApplyWizardPresetInput & {
  /** @deprecated Ignored — factory uses registry defaults as hydration base. */
  baseValues?: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  template: TenantWizardTemplate;
};

/**
 * Denali preset pipeline via {@link denaliTemplateOrchestratorFactory} (single hydration authority).
 */
export async function applyDenaliWizardPreset(
  input: ApplyDenaliWizardPresetInput,
): Promise<OrchestrateDenaliWizardResult> {
  return orchestrateDenaliWizardFromTemplate(
    input.template,
    presetCanonicalDataForFactory(input.canonicalData),
  );
}
