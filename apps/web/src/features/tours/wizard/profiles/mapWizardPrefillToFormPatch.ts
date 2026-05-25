import type { TourFormProfile } from "@repo/types";

import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { transformTourToWizardValues } from "@/features/tours/clone/transformTourToWizardValues";
import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import { isDenaliPilotFormProfile } from "@/features/tours/wizard/isDenaliWizardContext";
import { mapToDenaliWizardPatch } from "@/features/tours/wizard/profiles/denali/mapToDenaliWizardPatch";
import {
  mapPresetToFormPatch,
  type PresetMapperContext,
} from "@/features/tours/wizard/profiles/mapPresetToFormPatch";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

export type WizardPrefillSource =
  | {
      kind: "preset";
      defaults: Record<string, unknown>;
      ctx?: PresetMapperContext;
    }
  | {
      kind: "clone";
      tour: TourCloneSourceDto;
      activeEquipmentIds?: readonly string[];
    };

/**
 * Public entry for preset/clone → wizard form patch.
 * Workspace `formProfile` selects Denali (`mapToDenaliWizardPatch`) vs classic
 * (`mapPresetToFormPatch` / `transformTourToWizardValues`).
 */
export function mapWizardPrefillToFormPatch(
  formProfile: TourFormProfile | string | null | undefined,
  source: WizardPrefillSource,
): Partial<TourCreateFormValues> | Partial<DenaliCreateTourWizardForm> {
  if (isDenaliPilotFormProfile(formProfile ?? undefined)) {
    if (source.kind === "preset") {
      return mapToDenaliWizardPatch({
        kind: "preset",
        defaults: source.defaults,
        ctx: source.ctx,
      });
    }
    return mapToDenaliWizardPatch({
      kind: "clone",
      tour: source.tour,
      activeEquipmentIds: source.activeEquipmentIds,
    });
  }
  if (source.kind === "preset") {
    return mapPresetToFormPatch(formProfile, source.defaults, source.ctx);
  }
  return transformTourToWizardValues(source.tour);
}
