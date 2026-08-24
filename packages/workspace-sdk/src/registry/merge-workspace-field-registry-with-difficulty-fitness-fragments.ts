import type { WorkspaceFieldRegistry, WorkspaceFieldRegistryEntry } from "./field-registry";
import type { WorkspaceDifficultyFitnessFieldRegistryFragment } from "../difficulty-fitness/workspace-difficulty-fitness-field-module";

/**
 * CW7-09 — merge manifest-bound difficulty/fitness field fragments into a workspace field registry.
 * Fragment fields replace same `id` rows; workspaces without a fragment are unchanged.
 */
export function mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments(
  registry: WorkspaceFieldRegistry,
  difficultyFitnessFragment: WorkspaceDifficultyFitnessFieldRegistryFragment | undefined
): WorkspaceFieldRegistry {
  if (difficultyFitnessFragment === undefined || difficultyFitnessFragment.fields.length === 0) {
    return registry;
  }

  const mergedById = new Map<string, WorkspaceFieldRegistryEntry>(
    registry.fields.map((field) => [field.id, field])
  );
  for (const field of difficultyFitnessFragment.fields) {
    mergedById.set(field.id, field);
  }

  return Object.freeze({
    version: registry.version,
    fields: Object.freeze(
      [...mergedById.values()].sort((left, right) => left.id.localeCompare(right.id))
    ),
  });
}
