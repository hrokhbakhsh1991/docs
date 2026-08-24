import type { WorkspaceFieldRegistry, WorkspaceFieldRegistryEntry } from "./field-registry";
import type { WorkspacePricingFieldRegistryFragment } from "../pricing/workspace-pricing-field-module";

/**
 * CW7-11 — merge manifest-bound pricing field fragments into a workspace field registry.
 */
export function mergeWorkspaceFieldRegistryWithPricingFragments(
  registry: WorkspaceFieldRegistry,
  pricingFragment: WorkspacePricingFieldRegistryFragment | undefined
): WorkspaceFieldRegistry {
  if (pricingFragment === undefined || pricingFragment.fields.length === 0) {
    return registry;
  }

  const mergedById = new Map<string, WorkspaceFieldRegistryEntry>(
    registry.fields.map((field) => [field.id, field])
  );
  for (const field of pricingFragment.fields) {
    mergedById.set(field.id, field);
  }

  return Object.freeze({
    version: registry.version,
    fields: Object.freeze(
      [...mergedById.values()].sort((left, right) => left.id.localeCompare(right.id))
    ),
  });
}
