import { assertThemeCssValueIsSafe } from "./theme-css-value-safety";
import {
  throwWorkspaceValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";

export type CssMapValidationOptions = {
  readonly maxVariables: number;
  readonly maxValueLength: number;
  readonly keyPattern: RegExp;
  readonly normalizeKey: (rawKey: string) => string;
  readonly pathPrefix: string;
};

function fail(code: WorkspaceSdkValidationErrorCode, message: string): never {
  throwWorkspaceValidationError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Shared cssVariables map validation for workspace plugin and tenant themes.
 */
export function normalizeAndValidateCssMap(
  raw: unknown,
  options: CssMapValidationOptions,
): Record<string, string> {
  if (!isPlainObject(raw)) {
    fail("INVALID_THEME_CSS_KEY", `${options.pathPrefix} must be a plain object`);
  }

  const entries = Object.entries(raw);
  if (entries.length > options.maxVariables) {
    fail(
      "THEME_CSS_VARIABLE_LIMIT",
      `${options.pathPrefix} exceeds maximum count (${options.maxVariables})`,
    );
  }

  const sanitized: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const normalizedKey = options.normalizeKey(rawKey);
    if (!options.keyPattern.test(normalizedKey)) {
      fail(
        "INVALID_THEME_CSS_KEY",
        `${options.pathPrefix} key "${rawKey}" failed normalization (${normalizedKey})`,
      );
    }

    if (typeof rawValue !== "string") {
      fail(
        "INVALID_THEME_CSS_VALUE",
        `${options.pathPrefix}["${rawKey}"] must be a string`,
      );
    }

    const trimmed = rawValue.trim();
    if (trimmed.length === 0) {
      fail(
        "INVALID_THEME_CSS_VALUE",
        `${options.pathPrefix}["${rawKey}"] must be non-empty`,
      );
    }

    if (trimmed.length > options.maxValueLength) {
      fail(
        "INVALID_THEME_CSS_VALUE",
        `${options.pathPrefix}["${rawKey}"] exceeds maximum length (${options.maxValueLength})`,
      );
    }

    assertThemeCssValueIsSafe(rawKey, trimmed);
    sanitized[normalizedKey] = trimmed;
  }

  return sanitized;
}
