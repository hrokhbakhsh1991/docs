import { throwWorkspaceValidationError } from "../errors/workspace-validation-errors.js";

const THEME_CSS_URL_PATTERN = /url\s*\(/i;

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

/**
 * Allowed `url(...)` shapes in theme CSS values (empty = block all url()).
 */
const ALLOWED_THEME_URL_PATTERNS: readonly RegExp[] = [];

/** Blocks `\`, `\u`, `\x`, and other CSS backslash escapes (checked on raw + NFKC forms). */
const CSS_ESCAPE_PATTERN = /\\/;

function assertNoCssEscapes(rawKey: string, value: string): void {
  if (CSS_ESCAPE_PATTERN.test(value)) {
    throwWorkspaceValidationError(
      "UNSAFE_THEME_CSS_VALUE",
      `CSS variable "${rawKey}" contains disallowed CSS escape sequences`,
    );
  }
}

function normalizeThemeCssValueForSafety(value: string): string {
  return value.normalize("NFKC");
}

/**
 * Shared ingress rules for workspace and tenant CSS custom property values.
 */
export function assertThemeCssValueIsSafe(rawKey: string, rawValue: string): void {
  assertNoCssEscapes(rawKey, rawValue);

  const normalized = normalizeThemeCssValueForSafety(rawValue);
  assertNoCssEscapes(rawKey, normalized);

  for (const pattern of UNSAFE_THEME_CSS_VALUE_PATTERNS) {
    if (pattern.test(normalized)) {
      throwWorkspaceValidationError(
        "UNSAFE_THEME_CSS_VALUE",
        `CSS variable "${rawKey}" contains unsafe content`,
      );
    }
  }

  if (THEME_CSS_URL_PATTERN.test(normalized)) {
    const allowlisted = ALLOWED_THEME_URL_PATTERNS.some((pattern) => pattern.test(normalized));
    if (!allowlisted) {
      throwWorkspaceValidationError(
        "UNSAFE_THEME_CSS_VALUE",
        `CSS variable "${rawKey}" contains disallowed url() — not on theme URL allowlist`,
      );
    }
  }
}
