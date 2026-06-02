import type { CSSProperties } from "react";

import type { TenantThemeConfig } from "@repo/core";

/** Token names without a leading `--`. */
export function normalizeCssVariableName(key: string): string {
  return key.trim().replace(/^--/, "");
}

/**
 * Maps tenant theme config to inline CSS custom properties for a wrapper element.
 * Descendants using `var(--color-…)` from `@tour/ui` inherit these overrides.
 */
export function buildTenantThemeStyle(theme: TenantThemeConfig): CSSProperties {
  const tokens: Record<string, string> = {};

  const primaryColor = theme.primaryColor?.trim();
  if (primaryColor) {
    tokens["color-primary"] = primaryColor;
    tokens["color-primary-hover"] = primaryColor;
    tokens["color-primary-active"] = primaryColor;
    tokens["color-primary-500"] = primaryColor;
    tokens["color-primary-600"] = primaryColor;
    tokens["color-primary-700"] = primaryColor;
    tokens["color-text-link"] = primaryColor;
    tokens["color-text-link-hover"] = primaryColor;
    tokens["color-brand-400"] = primaryColor;
    tokens["color-brand-500"] = primaryColor;
    tokens["color-info"] = primaryColor;
  }

  if (theme.cssVariables) {
    for (const [key, value] of Object.entries(theme.cssVariables)) {
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
