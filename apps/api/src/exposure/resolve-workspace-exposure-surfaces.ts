import type { WorkspaceExposureSurfaceDefinition } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

export async function listOperatorVisibleExposureSurfaceDefinitions(
  workspaceType: string,
): Promise<readonly WorkspaceExposureSurfaceDefinition[]> {
  const manifest = (await resolveWorkspacePluginForType(workspaceType)).exposureSurface;
  if (manifest === undefined) {
    return Object.freeze([]);
  }
  return Object.freeze(
    manifest.definitions.filter((definition) => definition.operatorSettingsVisible !== false),
  );
}

export async function findWorkspaceExposureSurfaceDefinition(
  workspaceType: string,
  surface: string,
): Promise<WorkspaceExposureSurfaceDefinition | null> {
  const manifest = (await resolveWorkspacePluginForType(workspaceType)).exposureSurface;
  if (manifest === undefined) {
    return null;
  }
  return manifest.definitions.find((definition) => definition.surface === surface) ?? null;
}

export async function workspaceSupportsExposureSurfaces(workspaceType: string): Promise<boolean> {
  return (await listOperatorVisibleExposureSurfaceDefinitions(workspaceType)).length > 0;
}
