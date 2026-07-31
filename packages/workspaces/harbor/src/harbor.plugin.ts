import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import { harborCatalogIntakeSurface } from "./catalog/catalog-intake";

export const HARBOR_WORKSPACE_PLUGIN_ID = "harbor" as const;
export const HARBOR_WORKSPACE_TYPE = "harbor" as const;

export function getWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: HARBOR_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [HARBOR_WORKSPACE_TYPE],
    catalogIntake: harborCatalogIntakeSurface,
  });
}

/** Branded alias — same singleton factory as {@link getWorkspacePlugin}. */
export function getHarborWorkspacePlugin(): WorkspacePlugin {
  return getWorkspacePlugin();
}
