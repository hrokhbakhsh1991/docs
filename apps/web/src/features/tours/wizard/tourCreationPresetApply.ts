import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { tryHydrateCanonicalTemplate } from "@/features/tours/wizard/denali/canonicalTemplateHydration";
import { templateToCanonical, type DenaliCanonicalTemplateData } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { mapWizardPrefillToFormPatch } from "./profiles/mapWizardPrefillToFormPatch";
import type { PresetMapperContext } from "./profiles/mapPresetToFormPatch";

/** Shared input for preset apply (banner + `?presetId=` bootstrap). */
export type ApplyWizardPresetInput = {
  workspaceFormProfile: TourFormProfile;
  /** @deprecated Classic wizard roots; use {@link canonicalData} for Denali. */
  defaults?: Record<string, unknown>;
  canonicalData?: DenaliCanonicalTemplateData;
  ctx?: PresetMapperContext;
  themeCatalog?: SettingsTourThemeDto[];
  tenantFormContract?: TenantTourFormContract;
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
 * Denali preset pipeline: {@link templateToCanonical} → {@link tryHydrateCanonicalTemplate}.
 * Legacy `defaults` roots are discarded (not merged).
 */
export function applyDenaliWizardPreset(
  input: ApplyWizardPresetInput & { baseValues: DenaliCreateTourWizardForm },
): DenaliCreateTourWizardForm {
  const canonicalPatch = templateToCanonical({
    canonicalData: input.canonicalData,
    defaults: input.defaults,
  });
  if (Object.keys(canonicalPatch).length === 0) {
    return input.baseValues;
  }
  const hydrated = tryHydrateCanonicalTemplate(canonicalPatch, input.baseValues);
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
