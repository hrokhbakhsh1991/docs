import type { WorkspacePlugin } from "../plugin/workspace-plugin.contract.js";
import type { WorkspaceDefinitionPayload } from "../plugin/workspace-plugin-validation-core.js";

export type {
  WorkspaceDefinitionPayload,
  WorkspaceDefinitionThemePayload,
} from "../plugin/workspace-plugin-validation-core.js";
export {
  assertWorkspaceDefinitionPayload,
  validateWorkspaceDefinitionPayload,
} from "../plugin/workspace-plugin-validation-core.js";

/** Strip runtime hook surfaces from a package plugin for DB persistence (P3-A A4). Client-safe. */
export function stripWorkspacePluginToDefinitionPayload(
  plugin: WorkspacePlugin,
): WorkspaceDefinitionPayload {
  return {
    id: plugin.id,
    version: plugin.version,
    contractVersion: plugin.contractVersion,
    supportedWorkspaceTypes: plugin.supportedWorkspaceTypes,
    fieldRegistry: plugin.fieldRegistry,
    ruleSet: plugin.ruleSet,
    wizard: plugin.wizard,
  };
}
