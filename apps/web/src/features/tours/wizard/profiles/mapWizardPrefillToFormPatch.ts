import type { TourFormProfile } from "@repo/types";

import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { transformTourToWizardValues } from "@/features/tours/clone/transformTourToWizardValues";
import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import { mapToDenaliWizardPatch } from "@/features/tours/wizard/profiles/denali/mapToDenaliWizardPatch";
import {
  getCapabilitiesForProfile,
  normalizeTourFormProfileInput,
} from "@/lib/workspace/workspace-capabilities";
import {
  mapPresetToFormPatch,
  type PresetMapperContext,
} from "@/features/tours/wizard/profiles/mapPresetToFormPatch";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

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
  const { usesDenaliWizardShell } = getCapabilitiesForProfile(
    normalizeTourFormProfileInput(formProfile),
  );
  if (usesDenaliWizardShell) {
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
