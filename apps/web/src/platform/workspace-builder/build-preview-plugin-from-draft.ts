import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";
import { getStarterWorkspacePlugin, type WorkspacePlugin } from "@app-tour/workspace-sdk";

/** Merge starter hook surfaces with draft metadata fields (P3-C preview + publish). */
export function buildPreviewPluginFromDraft(
  payload: WorkspaceDefinitionPayload
): WorkspacePlugin {
  const overlay = getStarterWorkspacePlugin();
  return {
    ...overlay,
    id: payload.id,
    version: payload.version,
    contractVersion: payload.contractVersion,
    supportedWorkspaceTypes: payload.supportedWorkspaceTypes,
    fieldRegistry: payload.fieldRegistry,
    ruleSet: payload.ruleSet,
    wizard: payload.wizard,
    ...(payload.theme !== undefined ? { theme: overlay.theme } : {}),
  };
}

export function previewPluginUsesStarterValidation(plugin: WorkspacePlugin): boolean {
  return plugin.validation === getStarterWorkspacePlugin().validation;
}
