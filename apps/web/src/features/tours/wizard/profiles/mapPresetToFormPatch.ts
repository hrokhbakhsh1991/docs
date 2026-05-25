import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import { presetDefaultsToDenaliFormPatch } from "@/features/tours/wizard/presetDefaultsToDenaliFormPatch";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { presetDefaultsToFormPatch } from "@/features/tours/wizard/tourCreationPresetMatch";
import { isDenaliPilotFormProfile } from "@/features/tours/wizard/isDenaliWizardContext";

export type PresetMapperContext = {
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
};

/**
 * Profile-aware preset defaults → wizard form patch (map-phase F2.5).
 *
 * @internal Use {@link mapWizardPrefillToFormPatch} at app/UI call sites.
 */
export function mapPresetToFormPatch(
  formProfile: TourFormProfile | string | null | undefined,
  defaults: Record<string, unknown>,
  ctx?: PresetMapperContext,
): Partial<TourCreateFormValues> | Partial<DenaliCreateTourWizardForm> {
  if (isDenaliPilotFormProfile(formProfile ?? undefined)) {
    return presetDefaultsToDenaliFormPatch(defaults, {
      matchTourType: ctx?.matchTourType,
      matchMainTourThemeId: ctx?.matchMainTourThemeId,
    });
  }
  return presetDefaultsToFormPatch(defaults);
}
