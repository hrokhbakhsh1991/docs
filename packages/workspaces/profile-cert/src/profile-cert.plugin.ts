import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import { profileCertCatalogIntakeSurface } from "./catalog";

export const PROFILE_CERT_WORKSPACE_PLUGIN_ID = "profile-cert" as const;
export const PROFILE_CERT_WORKSPACE_TYPE = "profile-cert" as const;

export function getWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: PROFILE_CERT_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [PROFILE_CERT_WORKSPACE_TYPE],
    catalogIntake: profileCertCatalogIntakeSurface,
  });
}

/** Branded alias — same singleton factory as {@link getWorkspacePlugin}. */
export function getProfileCertWorkspacePlugin(): WorkspacePlugin {
  return getWorkspacePlugin();
}
