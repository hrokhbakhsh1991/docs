import type { WorkspacePlugin } from "./workspace-plugin.contract";
import { assertWorkspacePluginCore } from "./workspace-plugin-validation-core";
import { assertWorkspaceThemeContract } from "./workspace-plugin-theme-validation";

export {
  assertWorkspaceFieldRegistry,
  assertWorkspaceRuleSet,
  assertWorkspacePluginCore,
  throwWorkspaceValidationError,
  isWorkspaceSdkValidationError,
  WorkspaceThemeValidationError,
  WorkspaceRegistryValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "./workspace-plugin-validation-core";

export { assertWorkspaceThemeContract } from "./workspace-plugin-theme-validation";

/**
 * Full plugin validation including workspace theme ingress (Phase 2+).
 */
export function assertWorkspacePlugin(value: unknown): asserts value is WorkspacePlugin {
  assertWorkspacePluginCore(value);
  if (value.theme !== undefined) {
    assertWorkspaceThemeContract(value.theme);
  }
}
