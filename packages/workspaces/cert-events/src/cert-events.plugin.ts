import {
  createStarterWorkspacePlugin,
  type WorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import { certEventsCatalogIntakeSurface } from "./catalog";

export const CERT_EVENTS_WORKSPACE_PLUGIN_ID = "cert-events" as const;
export const CERT_EVENTS_WORKSPACE_TYPE = "cert-events" as const;

export function getWorkspacePlugin(): WorkspacePlugin {
  const base = createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
  return Object.freeze({
    ...base,
    id: CERT_EVENTS_WORKSPACE_PLUGIN_ID,
    supportedWorkspaceTypes: [CERT_EVENTS_WORKSPACE_TYPE],
    catalogIntake: certEventsCatalogIntakeSurface,
  });
}

/** Branded alias — same singleton factory as {@link getWorkspacePlugin}. */
export function getCertEventsWorkspacePlugin(): WorkspacePlugin {
  return getWorkspacePlugin();
}
