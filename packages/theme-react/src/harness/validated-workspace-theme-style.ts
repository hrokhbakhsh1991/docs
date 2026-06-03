import type { CSSProperties } from "react";

import {
  getStarterWorkspacePlugin,
  getWorkspaceThemePresets,
  type WorkspacePlugin,
  type WorkspaceThemeContract,
  type WorkspaceThemePresetId,
} from "@app-tour/workspace-sdk";

import { validateWorkspaceThemeIngress } from "../ingress/theme-ingress-guard";
import { workspaceThemeToStyle } from "../providers/normalize-workspace-theme-style";

/**
 * Full ingress path: {@link validateWorkspaceThemeIngress} → sealed theme → DOM style.
 * Use in Storybook / visual tests instead of applying raw `cssVariables` to `style`.
 */
export function validatedWorkspaceThemeStyle(
  plugin: WorkspacePlugin,
  theme: WorkspaceThemeContract | undefined,
): CSSProperties | undefined {
  const guarded = validateWorkspaceThemeIngress(plugin, theme);
  if (!guarded.theme) {
    return undefined;
  }
  return workspaceThemeToStyle(guarded.theme);
}

/** Convenience for {@link getWorkspaceThemePresets} with {@link getStarterWorkspacePlugin}. */
export function validatedWorkspacePresetStyle(
  presetId: WorkspaceThemePresetId,
  plugin: WorkspacePlugin = getStarterWorkspacePlugin(),
): CSSProperties | undefined {
  return validatedWorkspaceThemeStyle(plugin, getWorkspaceThemePresets()[presetId]);
}
