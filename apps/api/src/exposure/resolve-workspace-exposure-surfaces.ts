import type { WorkspaceExposureSurfaceDefinition } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

export function listOperatorVisibleExposureSurfaceDefinitions(
  workspaceType: string,
): readonly WorkspaceExposureSurfaceDefinition[] {
  const manifest = resolveWorkspacePluginForType(workspaceType).exposureSurface;
  if (manifest === undefined) {
    return Object.freeze([]);
  }
  return Object.freeze(
    manifest.definitions.filter((definition) => definition.operatorSettingsVisible !== false),
  );
}

export function findWorkspaceExposureSurfaceDefinition(
  workspaceType: string,
  surface: string,
): WorkspaceExposureSurfaceDefinition | null {
  const manifest = resolveWorkspacePluginForType(workspaceType).exposureSurface;
  if (manifest === undefined) {
    return null;
  }
  return manifest.definitions.find((definition) => definition.surface === surface) ?? null;
}

export function workspaceSupportsExposureSurfaces(workspaceType: string): boolean {
  return listOperatorVisibleExposureSurfaceDefinitions(workspaceType).length > 0;
}
