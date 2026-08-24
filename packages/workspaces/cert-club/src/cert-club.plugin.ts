import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import { certClubCatalogIntakeSurface } from "./catalog";

export const CERT_CLUB_WORKSPACE_PLUGIN_ID = "cert-club" as const;
export const CERT_CLUB_WORKSPACE_TYPE = "cert-club" as const;

export function getWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: CERT_CLUB_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [CERT_CLUB_WORKSPACE_TYPE],
    catalogIntake: certClubCatalogIntakeSurface,
  });
}

/** Branded alias — same singleton factory as {@link getWorkspacePlugin}. */
export function getCertClubWorkspacePlugin(): WorkspacePlugin {
  return getWorkspacePlugin();
}
