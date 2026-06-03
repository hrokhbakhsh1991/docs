import type { CSSProperties } from "react";

import {
  assertWorkspaceThemeContract,
  assertWorkspaceThemeSealed,
  normalizeThemeCssKey,
  type SealedWorkspaceTheme,
} from "@app-tour/workspace-sdk";

/** Maps sealed workspace variables to inline style keys (package-internal). */
function normalizeWorkspaceCssVariables(
  cssVariables: Readonly<Record<string, string>>,
): CSSProperties {
  const style: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(cssVariables)) {
    const key = normalizeThemeCssKey(rawKey);
    if (key.length === 0) {
      continue;
    }
    style[key] = value;
  }
  return style as CSSProperties;
}

/**
 * @internal DOM mapping — requires ingress-sealed theme (see {@link WorkspaceThemeProvider}).
 */
export function workspaceThemeToStyle(theme: SealedWorkspaceTheme): CSSProperties {
  assertWorkspaceThemeSealed(theme);
  assertWorkspaceThemeContract(theme);
  return normalizeWorkspaceCssVariables(theme.cssVariables);
}
