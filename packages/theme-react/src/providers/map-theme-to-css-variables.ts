import { normalizeThemeCssKey } from "@app-tour/workspace-sdk";

import type { CSSProperties } from "react";

/** Bare or `--*` keys from workspace.manifest.json `theme` blocks. */
export type PlatformThemeJson = Readonly<Record<string, string>>;

const CSS_VARIABLE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const UNSAFE_THEME_CSS_VALUE_PATTERNS = [
  /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*javascript/i,
  /javascript\s*:/i,
  /-moz-binding/i,
  /\bbehavior\s*:/i,
  /@import/i,
  /</,
  />/,
] as const;

const INLINE_STYLE_FORBIDDEN_CHARS = /[;{}\\]/;

function isValidCssVariableName(normalizedKey: string): boolean {
  const bare = normalizedKey.startsWith("--") ? normalizedKey.slice(2) : normalizedKey;
  return bare.length > 0 && CSS_VARIABLE_NAME_PATTERN.test(bare);
}

/** Mirrors workspace-sdk theme ingress rules — fail-soft for inline manifest tokens. */
function isSafePlatformThemeCssValue(value: string): boolean {
  if (INLINE_STYLE_FORBIDDEN_CHARS.test(value)) {
    return false;
  }

  const normalized = value.normalize("NFKC");
  if (INLINE_STYLE_FORBIDDEN_CHARS.test(normalized)) {
    return false;
  }

  for (const pattern of UNSAFE_THEME_CSS_VALUE_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  if (/url\s*\(/i.test(normalized)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes manifest/inline theme maps to React `style` CSS custom properties.
 * Invalid keys/values are dropped (fail-soft) so one bad token cannot break the tree.
 */
export function mapThemeToCssVariables(
  themeJson?: PlatformThemeJson,
): Record<string, string> {
  if (!themeJson) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(themeJson)) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const normalizedKey = normalizeThemeCssKey(rawKey);
    if (!isValidCssVariableName(normalizedKey)) {
      continue;
    }

    const trimmedValue = rawValue.trim();
    if (trimmedValue.length === 0 || !isSafePlatformThemeCssValue(trimmedValue)) {
      continue;
    }

    result[normalizedKey] = trimmedValue;
  }

  return result;
}

/**
 * Merges theme layers left-to-right; later layers override earlier keys.
 * Each layer is sanitized independently via {@link mapThemeToCssVariables}.
 */
export function mergeThemeCssVariables(
  ...layers: Array<PlatformThemeJson | undefined>
): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    Object.assign(merged, mapThemeToCssVariables(layer));
  }

  return merged;
}

/** Maps sanitized variables to a React inline style object. */
export function platformThemeJsonToStyle(
  ...layers: Array<PlatformThemeJson | undefined>
): CSSProperties {
  return mergeThemeCssVariables(...layers) as CSSProperties;
}
