import type { WorkspaceFieldRegistry, WorkspaceFieldRegistryEntry } from "./field-registry";
import type { WorkspaceItineraryFieldRegistryFragment } from "../itinerary/workspace-itinerary-field-module";

/**
 * CW7-10 — merge manifest-bound itinerary field fragments into a workspace field registry.
 */
export function mergeWorkspaceFieldRegistryWithItineraryFragments(
  registry: WorkspaceFieldRegistry,
  itineraryFragment: WorkspaceItineraryFieldRegistryFragment | undefined
): WorkspaceFieldRegistry {
  if (itineraryFragment === undefined || itineraryFragment.fields.length === 0) {
    return registry;
  }

  const mergedById = new Map<string, WorkspaceFieldRegistryEntry>(
    registry.fields.map((field) => [field.id, field])
  );
  for (const field of itineraryFragment.fields) {
    mergedById.set(field.id, field);
  }

  return Object.freeze({
    version: registry.version,
    fields: Object.freeze(
      [...mergedById.values()].sort((left, right) => left.id.localeCompare(right.id))
    ),
  });
}
