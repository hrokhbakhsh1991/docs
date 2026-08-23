import type { WorkspaceFieldRegistry, WorkspaceFieldRegistryEntry } from "./field-registry";
import type { WorkspaceEquipmentFieldRegistryFragment } from "../equipment/workspace-equipment-field-module";

/**
 * CW7-03 — merge manifest-bound equipment field fragments into a workspace field registry.
 * Fragment fields replace same `id` rows; workspaces without a fragment are unchanged.
 */
export function mergeWorkspaceFieldRegistryWithEquipmentFragments(
  registry: WorkspaceFieldRegistry,
  equipmentFragment: WorkspaceEquipmentFieldRegistryFragment | undefined
): WorkspaceFieldRegistry {
  if (equipmentFragment === undefined || equipmentFragment.fields.length === 0) {
    return registry;
  }

  const mergedById = new Map<string, WorkspaceFieldRegistryEntry>(
    registry.fields.map((field) => [field.id, field])
  );
  for (const field of equipmentFragment.fields) {
    mergedById.set(field.id, field);
  }

  return Object.freeze({
    version: registry.version,
    fields: Object.freeze(
      [...mergedById.values()].sort((left, right) => left.id.localeCompare(right.id))
    ),
  });
}
