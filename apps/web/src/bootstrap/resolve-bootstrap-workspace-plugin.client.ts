/**
 * Client-safe workspace plugin resolver — theme shells only.
 * Does **not** import generated loaders (avoids static product fan-in on hydrate).
 * Theme stylesheet paths come from manifest codegen (`WORKSPACE_ADMIN_THEME_REGISTRY`).
 * @see docs/dev/wave-b-thin-shell-bb.mdoc — Wave B.b.2
 */
import {
  type WorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  getStarterWorkspacePlugin,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

import { WORKSPACE_ADMIN_THEME_REGISTRY } from "./workspace-theme-stylesheets.generated";

function getStarterClientPlugin(): WorkspacePlugin {
  return getStarterWorkspacePlugin();
}

function buildThemeShellPlugin(pluginId: string, optionalStylesheet: string): WorkspacePlugin {
  const starter = getStarterClientPlugin();
  return {
    ...starter,
    id: pluginId,
    supportedWorkspaceTypes: [pluginId],
    theme: {
      ...workspaceThemePresets["platform-primary"],
      optionalStylesheet,
      cssVariables: {
        [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
      },
    },
  };
}

/**
 * Resolve a hydrate-safe plugin for the active admin `pluginId`.
 * Unknown ids and missing theme registry rows fall back to starter.
 */
export function resolveBootstrapWorkspacePluginClient(pluginId: string): WorkspacePlugin {
  const id = pluginId.trim();
  if (id.length === 0 || id === "starter") {
    return getStarterClientPlugin();
  }
  const sheets = WORKSPACE_ADMIN_THEME_REGISTRY[id];
  const optionalStylesheet = sheets?.[0];
  if (typeof optionalStylesheet !== "string" || optionalStylesheet.length === 0) {
    return getStarterClientPlugin();
  }
  return buildThemeShellPlugin(id, optionalStylesheet);
}
