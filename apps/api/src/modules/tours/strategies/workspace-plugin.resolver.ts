import {
  mockWorkspacePlugin,
  MOCK_WORKSPACE_PLUGIN_ID,
  resolveWorkspacePluginIdForProfile,
  type WorkspacePlugin,
} from "@repo/workspace-sdk";
import type { TourFormProfile } from "@repo/types";

/** Resolves SDK {@link WorkspacePlugin} for profiles with Phase 1.2 bindings. */
export function resolveWorkspacePluginForProfile(
  profile: TourFormProfile,
): WorkspacePlugin | null {
  const pluginId = resolveWorkspacePluginIdForProfile(profile);
  if (pluginId === MOCK_WORKSPACE_PLUGIN_ID) {
    return mockWorkspacePlugin;
  }
  return null;
}
