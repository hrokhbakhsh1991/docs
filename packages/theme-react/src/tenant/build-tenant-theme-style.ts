import {
  assertTenantThemeSealed,
  validateTenantTheme,
  type SealedTenantTheme,
} from "@app-tour/workspace-sdk";
import type { CSSProperties } from "react";

export function normalizeCssVariableName(key: string): string {
  return key.trim().replace(/^--/, "");
}

export type BuildTenantThemeStyleOptions = {
  /** When true, skip tenant primaryColor inline vars so CSS dark cascade (e.g. a workspace admin skin) wins. @see docs/dev/dtcg-pipeline-spec.mdoc § F9-4 */
  readonly omitPrimaryColor?: boolean;
};

const PRIMARY_TOKEN_KEYS = new Set(["color-primary", "color-primary-hover", "color-text-link"]);

/**
 * @internal DOM mapping — requires sealed tenant theme (see {@link TenantThemeProvider}).
 * Safety seal: WeakSet + {@link validateTenantTheme} re-check before DOM mapping.
 */
export function buildTenantThemeStyle(
  theme: SealedTenantTheme,
  options: BuildTenantThemeStyleOptions = {},
): CSSProperties {
  assertTenantThemeSealed(theme);
  const safe = validateTenantTheme(theme);
  const tokens: Record<string, string> = {};
  const omitPrimary = options.omitPrimaryColor === true;

  const primaryColor = safe.primaryColor?.trim();
  if (primaryColor && !omitPrimary) {
    tokens["color-primary"] = primaryColor;
    tokens["color-primary-hover"] = primaryColor;
    tokens["color-text-link"] = primaryColor;
  }

  if (safe.cssVariables) {
    for (const [key, value] of Object.entries(safe.cssVariables)) {
      const normalized = normalizeCssVariableName(key);
      if (!normalized || !value.trim()) {
        continue;
      }
      if (omitPrimary && PRIMARY_TOKEN_KEYS.has(normalized)) {
        continue;
      }
      tokens[normalized] = value.trim();
    }
  }

  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) {
    style[`--${name}`] = value;
  }

  return style as CSSProperties;
}
