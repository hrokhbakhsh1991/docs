import { getWorkspaceDifficultyFitnessCapabilities } from "@app-tour/workspace-sdk";
import type {
  WorkspaceValidationPipelineContext,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { readCanonicalPath, readFiniteNumber, readNonEmptyString } from "./canonical-path.ts";

const DIFFICULTY_LEVEL_PATH = "program.difficultyLevel";
const FITNESS_LEVEL_PATH = "participants.fitnessLevel";

/** MAT-002 — generic difficulty/fitness capability structural validation (CW7-09). */
export function validateWorkspaceDifficultyFitnessCapability(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceViolation | null {
  const capabilities = getWorkspaceDifficultyFitnessCapabilities(ctx.workspaceType);
  if (capabilities == null || capabilities.wizardTourField !== true) {
    return null;
  }

  const data = ctx.document.data as Record<string, unknown>;
  const rawDifficulty = readCanonicalPath(data, DIFFICULTY_LEVEL_PATH);
  if (rawDifficulty !== undefined) {
    const difficulty = readFiniteNumber(rawDifficulty);
    if (difficulty == null) {
      return {
        code: "WORKSPACE_DIFFICULTY_FITNESS_INVALID",
        message: `${DIFFICULTY_LEVEL_PATH} must be a finite number when present`,
      };
    }
  }

  const rawFitness = readCanonicalPath(data, FITNESS_LEVEL_PATH);
  if (rawFitness !== undefined && readNonEmptyString(rawFitness) == null) {
    return {
      code: "WORKSPACE_DIFFICULTY_FITNESS_INVALID",
      message: `${FITNESS_LEVEL_PATH} must be a non-empty string when present`,
    };
  }

  return null;
}
