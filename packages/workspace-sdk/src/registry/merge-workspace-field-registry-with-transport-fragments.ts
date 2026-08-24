import type { WorkspaceFieldRegistry, WorkspaceFieldRegistryEntry } from "./field-registry";
import type { WorkspaceTransportFieldRegistryFragment } from "../transport/workspace-transport-field-module";

/** CW7-07 — merge manifest-bound transport field fragments into a workspace field registry. */
export function mergeWorkspaceFieldRegistryWithTransportFragments(
  registry: WorkspaceFieldRegistry,
  transportFragment: WorkspaceTransportFieldRegistryFragment | undefined
): WorkspaceFieldRegistry {
  if (transportFragment === undefined || transportFragment.fields.length === 0) {
    return registry;
  }

  const mergedById = new Map<string, WorkspaceFieldRegistryEntry>(
    registry.fields.map((field) => [field.id, field])
  );
  for (const field of transportFragment.fields) {
    mergedById.set(field.id, field);
  }

  return Object.freeze({
    version: registry.version,
    fields: Object.freeze(
      [...mergedById.values()].sort((left, right) => left.id.localeCompare(right.id))
    ),
  });
}
