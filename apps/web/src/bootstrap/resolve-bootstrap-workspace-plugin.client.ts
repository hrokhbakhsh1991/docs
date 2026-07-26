/**
 * Client-safe workspace plugin resolver — theme shells only.
 * Does **not** import generated loaders (avoids static product fan-in on hydrate).
 * Theme stylesheet paths come from manifest codegen (`resolveAdminThemeStylesheets`).
 * Fail-closed: unknown / blank pluginId never becomes starter.
 * @see docs/dev/wave-b-thin-shell-bb.mdoc — Wave B.b.2
 */
import {
  type WorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  getStarterWorkspacePlugin,
  workspaceThemePresets,
} from "@app-cloud/workspace-sdk";

import {
  WorkspacePluginNotFoundError,
  requireWorkspacePluginId,
} from "./workspace-plugin-context-errors";
import { resolveAdminThemeStylesheets } from "./workspace-theme-stylesheets.generated";

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
 * Explicit `"starter"` returns the SDK starter reference; unknown ids throw.
 */
export function resolveBootstrapWorkspacePluginClient(pluginId: string): WorkspacePlugin {
  const id = requireWorkspacePluginId(pluginId);
  if (id === "starter") {
    return getStarterClientPlugin();
  }
  const sheets = resolveAdminThemeStylesheets(id);
  const optionalStylesheet = sheets?.[0];
  if (typeof optionalStylesheet !== "string" || optionalStylesheet.length === 0) {
    throw new WorkspacePluginNotFoundError(id);
  }
  return buildThemeShellPlugin(id, optionalStylesheet);
}
