import { defineWorkspaceEquipmentFieldFragment } from "@app-tour/workspace-sdk";

import type { DenaliCreateWizardStepId } from "../layout/stepIds";

/** Canonical gear field path — Denali-owned; not a platform default. */
export const DENALI_EQUIPMENT_GEAR_CANONICAL_PATH = "participants.gearItems" as const;

/**
 * CW7-03 — tour-field config fragment merged into `denaliFieldRegistryData`.
 */
export const denaliEquipmentFieldModule = defineWorkspaceEquipmentFieldFragment({
  canonicalPath: DENALI_EQUIPMENT_GEAR_CANONICAL_PATH,
  stepId: "denali_logistics" as DenaliCreateWizardStepId,
  rhfPath: "participantRequirements.gearItems",
  zodPath: "participantRequirements.gearItems",
  zodKind: "gearItems",
  tags: ["gear"] as const,
  ruleDefaults: { required: false, hidden: false },
  wire: {
    kind: "derived",
    description: "Splits into tripDetails.participation gearRequiredIds / gearOptionalIds.",
  },
});
