import {
  workspaceThemePresets,
  WORKSPACE_THEME_CSS_VARIABLE,
} from "../theme/workspace-theme-presets";
import {
  createStarterWorkspacePlugin,
  STARTER_THEME_TOKENS_STYLESHEET,
} from "./starter-plugin-core";

export { STARTER_THEME_TOKENS_STYLESHEET, createStarterWorkspacePlugin } from "./starter-plugin-core";

const starterTheme = {
  ...workspaceThemePresets["platform-primary"],
  optionalStylesheet: STARTER_THEME_TOKENS_STYLESHEET,
  cssVariables: {
    [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
  },
} as const;

/** Reference starter plugin — frozen at module init (deterministic identity). */
export const starterWorkspacePlugin = Object.freeze(
  createStarterWorkspacePlugin(starterTheme),
) as ReturnType<typeof createStarterWorkspacePlugin>;

/**
 * @deprecated Prefer `starterWorkspacePlugin` or `createFreshStarterPlugin()` in contract tests.
 */
export function getStarterWorkspacePlugin(): typeof starterWorkspacePlugin {
  return starterWorkspacePlugin;
}
