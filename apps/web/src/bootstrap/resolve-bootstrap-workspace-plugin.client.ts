/**
 * Client-safe workspace plugin resolver — no Denali clone / node:crypto graph.
 * @see docs/workspaces/denali/public-catalog.md — Client bootstrap (M17 P3)
 */
import {
  type WorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban/plugin";

const DENALI_THEME_ADMIN_STYLESHEET = "theme/denali-admin.css" as const;

function getDenaliClientShellPlugin(): WorkspacePlugin {
  const starter = getStarterWorkspacePlugin();
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
  ["starter", getStarterWorkspacePlugin()],
  ["denali", getDenaliClientShellPlugin()],
  ["urban", getUrbanWorkspacePlugin()],
]);

export function resolveBootstrapWorkspacePluginClient(pluginId: string): WorkspacePlugin {
  return pluginsById.get(pluginId) ?? getStarterWorkspacePlugin();
}
