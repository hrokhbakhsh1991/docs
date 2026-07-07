import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import {
  WORKSPACE_GUEST_CONFORMANCE_LEVELS,
  type WorkspaceGuestConformanceLevel,
} from "./workspace-guest-conformance.generated";

export type { WorkspaceGuestConformanceLevel };

export class GuestConformanceNotConfiguredError extends Error {
  readonly code = "GUEST_CONFORMANCE_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`GUEST_CONFORMANCE_NOT_CONFIGURED:${pluginId}`);
    this.name = "GuestConformanceNotConfiguredError";
  }
}

/** Resolve manifest-derived guest conformance level for a workspace plugin id. */
export function resolveGuestConformanceLevelForPlugin(
  pluginId: WorkspacePluginId | string
): WorkspaceGuestConformanceLevel {
  const level = WORKSPACE_GUEST_CONFORMANCE_LEVELS[pluginId];
  if (level === undefined) {
    throw new GuestConformanceNotConfiguredError(pluginId);
  }
  return level;
}
