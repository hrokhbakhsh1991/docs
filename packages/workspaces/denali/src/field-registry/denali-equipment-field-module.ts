import type { WorkspaceEquipmentFieldRegistryFragment } from "@app-tour/workspace-sdk";

import { denaliRegistryPresentationFields } from "./denali-integration-field-presentation";
import {
  DENALI_EQUIPMENT_GEAR_CANONICAL_PATH,
  denaliEquipmentFieldModule,
} from "./denali-equipment-tour-field-module";

const gearTourField = denaliEquipmentFieldModule.fields[0];

/**
 * CW7-03 — workspace field-registry slice bound via manifest `fieldModule`.
 * Built without `buildDenaliWorkspaceFieldRegistry` to avoid field-registry data cycle.
 */
export const denaliEquipmentFieldRegistryFragment: WorkspaceEquipmentFieldRegistryFragment =
  Object.freeze({
    version: 1,
    fields: Object.freeze([
      Object.freeze({
        id: "denali.gear",
        canonicalPath: DENALI_EQUIPMENT_GEAR_CANONICAL_PATH,
        stepId: gearTourField.stepId,
        kind: "composite" as const,
        required: gearTourField.ruleDefaults.required,
        tags: gearTourField.tags,
        ...denaliRegistryPresentationFields({
          id: "denali.gear",
          canonicalPath: DENALI_EQUIPMENT_GEAR_CANONICAL_PATH,
          tags: gearTourField.tags,
        }),
      }),
    ]),
  });

export { DENALI_EQUIPMENT_GEAR_CANONICAL_PATH, denaliEquipmentFieldModule } from "./denali-equipment-tour-field-module";
