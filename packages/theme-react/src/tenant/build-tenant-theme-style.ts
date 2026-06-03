import {
  assertTenantThemeSealed,
  validateTenantTheme,
  type SealedTenantTheme,
} from "@app-tour/workspace-sdk";
import type { CSSProperties } from "react";

export function normalizeCssVariableName(key: string): string {
  return key.trim().replace(/^--/, "");
}

/**
 * @internal DOM mapping — requires sealed tenant theme (see {@link TenantThemeProvider}).
 * Safety seal: WeakSet + {@link validateTenantTheme} re-check before DOM mapping.
 */
export function buildTenantThemeStyle(theme: SealedTenantTheme): CSSProperties {
  assertTenantThemeSealed(theme);
  const safe = validateTenantTheme(theme);
  const tokens: Record<string, string> = {};

  const primaryColor = safe.primaryColor?.trim();
  if (primaryColor) {
    tokens["color-primary"] = primaryColor;
    tokens["color-primary-hover"] = primaryColor;
    tokens["color-text-link"] = primaryColor;
  }

  if (safe.cssVariables) {
    for (const [key, value] of Object.entries(safe.cssVariables)) {
      const normalized = normalizeCssVariableName(key);
      if (normalized && value.trim()) {
        tokens[normalized] = value.trim();
      }
    }
  }

  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) {
    style[`--${name}`] = value;
  }

  return style as CSSProperties;
}
