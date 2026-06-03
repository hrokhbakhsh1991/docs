import type { WorkspaceThemeContract } from "./workspace-theme.contract";

/** Canonical workspace CSS custom property names (ingress: `--ws-*` only). */
export const WORKSPACE_THEME_CSS_VARIABLE = {
  colorAccent: "--ws-color-accent",
} as const;

export type WorkspaceThemeCssVariable =
  (typeof WORKSPACE_THEME_CSS_VARIABLE)[keyof typeof WORKSPACE_THEME_CSS_VARIABLE];

export type WorkspaceThemePresetId = "default" | "platform-primary" | "platform-success";

function freezeWorkspaceThemePresets(
  presets: Record<WorkspaceThemePresetId, WorkspaceThemeContract>,
): Readonly<Record<WorkspaceThemePresetId, WorkspaceThemeContract>> {
  for (const preset of Object.values(presets)) {
    Object.freeze(preset.cssVariables);
    Object.freeze(preset);
  }
  return Object.freeze(presets);
}

const presetDefinitions: Record<WorkspaceThemePresetId, WorkspaceThemeContract> = {
  default: {
    id: "starter-default",
    version: 1,
    cssVariables: {},
  },
  "platform-primary": {
    id: "starter-primary-accent",
    version: 1,
    cssVariables: {
      [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
    },
  },
  "platform-success": {
    id: "starter-success-accent",
    version: 1,
    cssVariables: {
      [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-success)",
    },
  },
};

/** Frozen workspace accent presets — built once at module init (deterministic). */
export const workspaceThemePresets = freezeWorkspaceThemePresets(presetDefinitions);

/**
 * @deprecated Prefer `workspaceThemePresets` or `createHarnessTheme()` in tests.
 */
export function getWorkspaceThemePresets(): Readonly<
  Record<WorkspaceThemePresetId, WorkspaceThemeContract>
> {
  return workspaceThemePresets;
}

export function workspaceAccentCssValue(presetId: WorkspaceThemePresetId): string | undefined {
  const value = workspaceThemePresets[presetId].cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent];
  return value && value.length > 0 ? value : undefined;
}
