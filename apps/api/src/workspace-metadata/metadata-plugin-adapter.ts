import {
  assertWorkspacePlugin,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";
import { resolveWorkspaceThemeTokens } from "@app-tour/platform-core";
import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

function mergeMetadataThemeIntoOverlay(
  payload: WorkspaceDefinitionPayload,
  overlay: WorkspacePlugin
): WorkspacePlugin["theme"] | undefined {
  const tokenVars = resolveWorkspaceThemeTokens(payload.theme);
  if (tokenVars === undefined) {
    return overlay.theme;
  }
  if (overlay.theme === undefined) {
    return {
      id: payload.id,
      version: 1,
      cssVariables: tokenVars,
    };
  }
  return {
    ...overlay.theme,
    cssVariables: {
      ...overlay.theme.cssVariables,
      ...tokenVars,
    },
  };
}

/**
 * Merge DB metadata (fieldRegistry, ruleSet, wizard) with package hook surfaces.
 * Overlay supplies validation, lifecycle, wizardHost, finance HTTP bindings, etc.
 */
export function adaptMetadataPayloadToWorkspacePlugin(
  payload: WorkspaceDefinitionPayload,
  overlay: WorkspacePlugin
): WorkspacePlugin {
  const theme = mergeMetadataThemeIntoOverlay(payload, overlay);
  const plugin: WorkspacePlugin = {
    ...overlay,
    id: payload.id,
    version: payload.version,
    contractVersion: payload.contractVersion,
    supportedWorkspaceTypes: payload.supportedWorkspaceTypes,
    fieldRegistry: payload.fieldRegistry,
    ruleSet: payload.ruleSet,
    wizard: payload.wizard,
    ...(theme !== undefined ? { theme } : {}),
  };
  assertWorkspacePlugin(plugin);
  return plugin;
}
