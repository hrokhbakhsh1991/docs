import type { WorkspaceDifficultyFitnessFilterPresentation } from "@app-tour/workspace-sdk";

import {
  DENALI_MARKETING_DIFFICULTY_LEVELS,
  DENALI_MARKETING_DIFFICULTY_MAX,
  DENALI_MARKETING_FITNESS_LEVELS,
  snapDenaliCatalogDifficultyLevel,
} from "./catalog-filter-config";

/**
 * CW7-09 — Denali-owned marketing filter vocab (1–10 half-step scale, fitness enum).
 * Bound via manifest `workspaceDifficultyFitness.filterPresentation`.
 */
export const denaliDifficultyFitnessFilterPresentation: WorkspaceDifficultyFitnessFilterPresentation =
  Object.freeze({
    difficultyLevels: DENALI_MARKETING_DIFFICULTY_LEVELS,
    fitnessLevels: DENALI_MARKETING_FITNESS_LEVELS,
    difficultyMax: DENALI_MARKETING_DIFFICULTY_MAX,
    snapDifficultyLevel: snapDenaliCatalogDifficultyLevel,
  });
