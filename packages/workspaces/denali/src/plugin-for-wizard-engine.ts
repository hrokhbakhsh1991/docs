import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { stripWorkspacePluginForWizardEngine } from "@app-tour/platform-core";

/**
 * Strip callable host surfaces before `PlatformWizardEngine.create` (DG-3.5).
 * Thin alias of platform-core `stripWorkspacePluginForWizardEngine`.
 */
export function denaliPluginForWizardEngine(plugin: WorkspacePlugin): WorkspacePlugin {
  return stripWorkspacePluginForWizardEngine(plugin);
}
