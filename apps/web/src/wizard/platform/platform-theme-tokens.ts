import type { CSSProperties } from "react";

export const PLATFORM_WORKSPACE_THEME_MARKER = "platform" as const;

/** Apply metadata theme tokens on the wizard host wrapper (P3-B N-013). */
export function buildPlatformThemeInlineStyle(
  tokens: Readonly<Record<string, string>> | undefined
): CSSProperties | undefined {
  if (tokens === undefined || Object.keys(tokens).length === 0) {
    return undefined;
  }
  return { ...tokens } as CSSProperties;
}

export function platformThemeHostDataAttributes(
  tokens: Readonly<Record<string, string>> | undefined
): Record<string, string | undefined> {
  if (tokens === undefined || Object.keys(tokens).length === 0) {
    return {};
  }
  return {
    "data-workspace-theme": PLATFORM_WORKSPACE_THEME_MARKER,
  };
}

export function platformThemeHostProps(tokens: Readonly<Record<string, string>> | undefined): {
  readonly "data-workspace-theme"?: string;
  readonly style?: CSSProperties;
} {
  const style = buildPlatformThemeInlineStyle(tokens);
  const attrs = platformThemeHostDataAttributes(tokens);
  return {
    ...attrs,
    ...(style !== undefined ? { style } : {}),
  };
}
