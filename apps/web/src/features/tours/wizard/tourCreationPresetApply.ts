import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { tryHydrateCanonicalTemplate } from "@/features/tours/wizard/denali/canonicalTemplateHydration";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { templateToCanonical, type DenaliCanonicalTemplateData } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "./schemas/denaliCore.schema";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { mapWizardPrefillToFormPatch } from "./profiles/mapWizardPrefillToFormPatch";
import type { PresetMapperContext } from "./profiles/mapPresetToFormPatch";

/** Shared input for preset apply (banner + `?presetId=` bootstrap). */
export type ApplyWizardPresetInput = {
  workspaceFormProfile: TourFormProfile;
  /** @deprecated Classic wizard roots; ignored by Denali preset apply. */
  defaults?: Record<string, unknown>;
  canonicalData?: DenaliCanonicalTemplateData;
  ctx?: PresetMapperContext;
  themeCatalog?: SettingsTourThemeDto[];
  tenantFormContract?: TenantTourFormContract;
};

export type ApplyDenaliWizardPresetInput = ApplyWizardPresetInput & {
  baseValues: DenaliCreateTourWizardForm;
  /** Tenant overlay rule set from {@link mapTemplateToRuleModel}. */
  ruleSet: DenaliRuleSet;
};

/**
 * Classic wizard preset pipeline: {@link mapWizardPrefillToFormPatch} → {@link applyTourWizardPatch}.
 */
export function applyClassicWizardPreset(
  input: ApplyWizardPresetInput & { baseValues: TourCreateFormValues },
): TourCreateFormValues {
  const patch = mapWizardPrefillToFormPatch(input.workspaceFormProfile, {
    kind: "preset",
    defaults: input.defaults ?? {},
    ctx: input.ctx,
  }) as Partial<TourCreateFormValues>;

  const { mergedValues } = applyTourWizardPatch({
    baseValues: input.baseValues,
    patch,
    currentProfile: input.workspaceFormProfile,
    themeCatalog: input.themeCatalog,
    tourType: input.baseValues.overview?.tourType,
    tenantFormContract: input.tenantFormContract,
  });
  return mergedValues;
}

/**
 * Denali preset pipeline: {@link templateToCanonical} → {@link tryHydrateCanonicalTemplate}
 * with tenant {@link DenaliRuleSet}. Legacy `defaults` roots are not merged.
 */
export function applyDenaliWizardPreset(
  input: ApplyDenaliWizardPresetInput,
): DenaliCreateTourWizardForm {
  const canonicalPatch = templateToCanonical({
    canonicalData: input.canonicalData,
  });
  if (Object.keys(canonicalPatch).length === 0) {
    return input.baseValues;
  }
  const hydrated = tryHydrateCanonicalTemplate(
    canonicalPatch,
    input.baseValues,
    undefined,
    input.ruleSet,
  );
  return hydrated?.formValues ?? input.baseValues;
}

/** Banner / in-wizard apply (classic rail). */
export type ApplyTourCreationPresetInput = Omit<ApplyWizardPresetInput, "workspaceFormProfile"> & {
  /** @deprecated Use `workspaceFormProfile`. */
  resolvedFormProfile?: TourFormProfile;
  workspaceFormProfile?: TourFormProfile;
  baseValues: TourCreateFormValues;
};

export function applyTourCreationPreset(input: ApplyTourCreationPresetInput): TourCreateFormValues {
  const profile = input.workspaceFormProfile ?? input.resolvedFormProfile;
  if (!profile) {
    throw new Error("applyTourCreationPreset: profile is required");
  }

  return applyClassicWizardPreset({
    workspaceFormProfile: profile,
    defaults: input.defaults,
    ctx: input.ctx,
    baseValues: input.baseValues,
    themeCatalog: input.themeCatalog,
    tenantFormContract: input.tenantFormContract,
  });
}
