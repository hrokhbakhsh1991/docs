import { defineWorkspaceDifficultyFitnessFieldFragments } from "@app-tour/workspace-sdk";

import type { DenaliCreateWizardStepId } from "../layout/stepIds";

import type { DenaliFieldDefinition } from "./denaliFieldRegistryData";

export const DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH = "program.difficultyLevel" as const;
export const DENALI_FITNESS_LEVEL_CANONICAL_PATH = "participants.fitnessLevel" as const;

const denaliDifficultyLevelField = Object.freeze({
  canonicalPath: DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
  stepId: "denali_program" as DenaliCreateWizardStepId,
  rhfPath: "programNature.difficultyLevel",
  zodPath: "programNature.difficultyLevel",
  zodKind: "difficultyLevel",
  tags: ["outdoor_program", "event_program_hidden"] as const,
  ruleDefaults: { required: true, hidden: false },
  cellOverrides: {
    "event:single_day": { required: false, hidden: true },
  },
  wire: {
    kind: "derived" as const,
    description: "Denali 1–10 mountaineering difficulty scale; composite denali.difficulty-level UI.",
  },
}) satisfies DenaliFieldDefinition;

const denaliFitnessLevelField = Object.freeze({
  canonicalPath: DENALI_FITNESS_LEVEL_CANONICAL_PATH,
  stepId: "denali_pricing" as DenaliCreateWizardStepId,
  rhfPath: "participantRequirements.fitnessLevel",
  zodPath: "participantRequirements.fitnessLevel",
  zodKind: "fitnessLevel",
  tags: ["mountain_participants", "non_mountain_participants_hidden"] as const,
  ruleDefaults: { required: true, hidden: false },
  cellOverrides: {
    "desert:multi_day": { required: false, hidden: true },
    "desert:single_day": { required: false, hidden: true },
    "event:single_day": { required: false, hidden: true },
    "nature:multi_day": { required: false, hidden: true },
    "nature:single_day": { required: false, hidden: true },
  },
  wire: {
    kind: "derived" as const,
    description: "Denali fitness enum slug; mountain participant matrix gates visibility.",
  },
}) satisfies DenaliFieldDefinition;

/**
 * CW7-09 — tour-field configs bound via manifest `workspaceDifficultyFitness.fieldModule`.
 */
export const denaliDifficultyFitnessFieldModule = defineWorkspaceDifficultyFitnessFieldFragments([
  denaliDifficultyLevelField,
  denaliFitnessLevelField,
]);

export { denaliDifficultyLevelField, denaliFitnessLevelField };
