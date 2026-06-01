import type { TourFormProfile } from "@repo/types";

import type { WorkspacePluginId } from "./workspace-plugin-id";
import { MOCK_WORKSPACE_PLUGIN_ID } from "./workspace-plugin-id";

export interface WorkspaceProfileBinding {
  readonly profile: TourFormProfile;
  readonly pluginId: WorkspacePluginId;
}

/** Phase 1.2 default bindings — expanded when real plugins land in Phase 2. */
export const DEFAULT_WORKSPACE_PROFILE_BINDINGS: readonly WorkspaceProfileBinding[] = [
  { profile: "general", pluginId: MOCK_WORKSPACE_PLUGIN_ID },
];

export function resolveWorkspacePluginIdForProfile(
  profile: TourFormProfile,
  bindings: readonly WorkspaceProfileBinding[] = DEFAULT_WORKSPACE_PROFILE_BINDINGS,
): WorkspacePluginId | null {
  return bindings.find((binding) => binding.profile === profile)?.pluginId ?? null;
}
