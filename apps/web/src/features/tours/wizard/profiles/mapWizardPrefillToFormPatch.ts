import type { TourFormProfile } from "@repo/types";

import type { TourCloneSourceDto } from "@/features/tours/clone/tourCloneSource.types";
import { mapToDenaliWizardPatch } from "@/features/tours/wizard/profiles/denali/mapToDenaliWizardPatch";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import type { PresetMapperContext } from "@/features/tours/wizard/profiles/mapPresetToFormPatch";

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

/** Denali-only preset/clone → wizard form patch. */
export function mapWizardPrefillToFormPatch(
  _formProfile: TourFormProfile | string | null | undefined,
  source: WizardPrefillSource,
): Partial<DenaliCreateTourWizardForm> {
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
