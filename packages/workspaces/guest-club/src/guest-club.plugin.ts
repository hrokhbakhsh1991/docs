import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import { guestClubCatalogIntakeSurface } from "./catalog";

export const GUEST_CLUB_WORKSPACE_PLUGIN_ID = "guest-club" as const;
export const GUEST_CLUB_WORKSPACE_TYPE = "guest-club" as const;

export function getGuestClubWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: GUEST_CLUB_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [GUEST_CLUB_WORKSPACE_TYPE],
    catalogIntake: guestClubCatalogIntakeSurface,
  });
}

/** Canonical host-contract getter (manifest plugin/web.export; Phase 4p). */
export function getWorkspacePlugin(): WorkspacePlugin {
  return getGuestClubWorkspacePlugin();
}

