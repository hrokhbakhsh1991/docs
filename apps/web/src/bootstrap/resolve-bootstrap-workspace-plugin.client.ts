/**
 * Client-safe workspace plugin resolver — no Denali clone / node:crypto graph.
 * Starter and urban resolve via codegen registry; Denali uses a lightweight shell stub.
 * @see docs/workspaces/denali/public-catalog.md — Client bootstrap (M17 P3)
 */
import {
  type WorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

import { resolveSyncWorkspacePluginFromRegistry } from "./workspace-plugin-loaders.generated";

const DENALI_THEME_ADMIN_STYLESHEET = "theme/denali-admin.css" as const;

function getDenaliClientShellPlugin(): WorkspacePlugin {
  const starter = resolveSyncWorkspacePluginFromRegistry("starter");
  return {
    ...starter,
    id: "denali",
    supportedWorkspaceTypes: ["denali"],
    theme: {
      ...workspaceThemePresets["platform-primary"],
      optionalStylesheet: DENALI_THEME_ADMIN_STYLESHEET,
      cssVariables: {
        [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
      },
    },
  };
}

const pluginsById = new Map<string, WorkspacePlugin>([
  ["starter", resolveSyncWorkspacePluginFromRegistry("starter")],
  ["denali", getDenaliClientShellPlugin()],
  ["urban", resolveSyncWorkspacePluginFromRegistry("urban")],
]);

export function resolveBootstrapWorkspacePluginClient(pluginId: string): WorkspacePlugin {
  return pluginsById.get(pluginId) ?? resolveSyncWorkspacePluginFromRegistry("starter");
}
