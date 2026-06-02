import type { TourFormProfile } from "@repo/types";

import { presetDefaultsToDenaliFormPatch } from "@/features/tours/wizard/presetDefaultsToDenaliFormPatch";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  getCapabilitiesForProfile,
  normalizeTourFormProfileInput,
} from "@/lib/workspace/workspace-capabilities";

export type PresetMapperContext = {
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
};

/** Denali preset defaults → wizard form patch. */
export function mapPresetToFormPatch(
  formProfile: TourFormProfile | string | null | undefined,
  defaults: Record<string, unknown>,
  ctx?: PresetMapperContext,
): Partial<DenaliCreateTourWizardForm> {
  getCapabilitiesForProfile(normalizeTourFormProfileInput(formProfile));
  return presetDefaultsToDenaliFormPatch(defaults, {
    matchTourType: ctx?.matchTourType,
    matchMainTourThemeId: ctx?.matchMainTourThemeId,
  });
}
