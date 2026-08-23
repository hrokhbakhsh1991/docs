import { DEFAULT_WORKSPACE_TYPE_BINDINGS } from "@app-tour/workspace-sdk";

import { WORKSPACE_CANONICAL_TOUR_BINDINGS } from "./workspace-canonical-tour-bindings.generated";

const REGISTERED_WORKSPACE_TYPES = new Set(
  DEFAULT_WORKSPACE_TYPE_BINDINGS.map((binding) => binding.workspaceType)
);

/**
 * Registered workspaces without an explicit canonical declaration retain the
 * existing neutral version-1 contract.
 */
const DEFAULT_REGISTERED_SCHEMA_VERSION = 1;

export function resolveWorkspaceCurrentSchemaVersion(workspaceType: string): number {
  const normalized = workspaceType.trim().toLowerCase();
  const binding = WORKSPACE_CANONICAL_TOUR_BINDINGS.find(
    (entry) => entry.workspaceType === normalized
  );
  if (binding !== undefined && "currentSchemaVersion" in binding) {
    return binding.currentSchemaVersion;
  }
  if (REGISTERED_WORKSPACE_TYPES.has(normalized)) {
    return DEFAULT_REGISTERED_SCHEMA_VERSION;
  }
  throw new Error(`WORKSPACE_SCHEMA_VERSION_UNAVAILABLE:${workspaceType}`);
}
