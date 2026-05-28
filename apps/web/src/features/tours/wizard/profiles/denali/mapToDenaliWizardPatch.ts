import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import {
  presetDefaultsToDenaliFormPatch,
  type PresetToDenaliContext,
} from "@/features/tours/wizard/presetDefaultsToDenaliFormPatch";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

export type DenaliWizardPatchSource =
  | {
      kind: "preset";
      defaults: Record<string, unknown>;
      ctx?: PresetToDenaliContext;
    }
  | {
      kind: "clone";
      tour: TourCloneSourceDto;
      activeEquipmentIds?: readonly string[];
    }
  | {
      kind: "create";
      tour: TourCloneSourceDto;
      activeEquipmentIds?: readonly string[];
    }
  | { kind: "blank" };

/**
 * Single entry for Denali wizard prefill patches (map-phase P2.2).
 */
export function mapToDenaliWizardPatch(
  source: DenaliWizardPatchSource,
): Partial<DenaliCreateTourWizardForm> {
  if (source.kind === "blank") {
    return {};
  }
  if (source.kind === "clone") {
    return transformTourToDenaliWizardValues(source.tour, {
      mode: "clone",
      activeEquipmentIds: source.activeEquipmentIds,
    });
  }
  if (source.kind === "create") {
    return transformTourToDenaliWizardValues(source.tour, {
      mode: "create",
      activeEquipmentIds: source.activeEquipmentIds,
    });
  }
  return presetDefaultsToDenaliFormPatch(source.defaults, source.ctx ?? {});
}
