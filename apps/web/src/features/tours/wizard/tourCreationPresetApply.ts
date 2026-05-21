import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { mergeDenaliWizardDefaults } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { mapWizardPrefillToFormPatch } from "./profiles/mapWizardPrefillToFormPatch";
import type { PresetMapperContext } from "./profiles/mapPresetToFormPatch";

/** Shared input for preset apply (banner + `?presetId=` bootstrap). */
export type ApplyWizardPresetInput = {
  workspaceFormProfile: TourFormProfile;
  defaults: Record<string, unknown>;
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
    defaults: input.defaults,
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
 * Denali preset pipeline: {@link mapWizardPrefillToFormPatch} → merge onto defaults.
 * (Denali has no `applyTourWizardPatch` yet; mapping entry point is unified.)
 */
export function applyDenaliWizardPreset(
  input: ApplyWizardPresetInput & { baseValues: DenaliCreateTourWizardForm },
): DenaliCreateTourWizardForm {
  const patch = mapWizardPrefillToFormPatch(input.workspaceFormProfile, {
    kind: "preset",
    defaults: input.defaults,
    ctx: input.ctx,
  }) as Partial<DenaliCreateTourWizardForm>;
  return mergeDenaliWizardDefaults(input.baseValues, patch);
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
