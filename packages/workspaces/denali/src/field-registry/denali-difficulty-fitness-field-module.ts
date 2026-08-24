import type { WorkspaceDifficultyFitnessFieldRegistryFragment } from "@app-tour/workspace-sdk";

import { denaliRegistryPresentationFields } from "./denali-integration-field-presentation";
import {
  DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
  denaliDifficultyFitnessFieldModule,
} from "./denali-difficulty-fitness-tour-field-module";

const difficultyTourField = denaliDifficultyFitnessFieldModule.fields[0];

/**
 * CW7-09 — workspace field-registry slice bound via manifest `fieldModule`.
 * Fitness (`participants.fitnessLevel`) remains inside `denali.pricing-participants` composite
 * until a future composite split; tour-field module still declares both paths.
 */
export const denaliDifficultyFitnessFieldRegistryFragment: WorkspaceDifficultyFitnessFieldRegistryFragment =
  Object.freeze({
    version: 1,
    fields: Object.freeze([
      Object.freeze({
        id: "denali.difficulty-level",
        canonicalPath: DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
        stepId: difficultyTourField.stepId,
        kind: "number" as const,
        required: difficultyTourField.ruleDefaults.required,
        tags: difficultyTourField.tags,
        ...denaliRegistryPresentationFields({
          id: "denali.difficulty-level",
          canonicalPath: DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
          tags: difficultyTourField.tags,
        }),
      }),
    ]),
  });

export {
  DENALI_DIFFICULTY_LEVEL_CANONICAL_PATH,
  DENALI_FITNESS_LEVEL_CANONICAL_PATH,
  denaliDifficultyFitnessFieldModule,
} from "./denali-difficulty-fitness-tour-field-module";
