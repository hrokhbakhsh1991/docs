import type { WorkspaceThemeContract } from "../theme/workspace-theme.contract";
import { normalizeAndValidateCssMap } from "../theme/css-map-validation";
import { normalizeThemeCssKey } from "../theme/normalize-theme-css-key";
import {
  throwWorkspaceValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";

const MAX_THEME_CSS_VARIABLES = 64;
const MAX_THEME_CSS_VALUE_LENGTH = 4096;
const THEME_CSS_KEY_PATTERN = /^--ws-[a-z0-9-]+$/;
const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
function fail(code: WorkspaceSdkValidationErrorCode, message: string): never {
  throwWorkspaceValidationError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function decodeThemeStylesheetPath(path: string): string {
  let decoded = path;
  try {
    for (let pass = 0; pass < 3; pass += 1) {
      const next = decodeURIComponent(decoded.replace(/\+/g, " "));
      if (next === decoded) {
        break;
      }
      decoded = next;
    }
  } catch {
    fail("INVALID_THEME_STYLESHEET", "theme.optionalStylesheet is not a valid URI-encoded path");
  }
  return decoded;
}

const WINDOWS_DRIVE_PATH_PATTERN = /^[a-zA-Z]:[/\\]/;

function assertOptionalStylesheetPathIsStrictlyRelative(rawPath: string): void {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    fail("INVALID_THEME_STYLESHEET", "theme.optionalStylesheet must be a non-empty string");
  }

  const sheet = decodeThemeStylesheetPath(trimmed);

  if (WINDOWS_DRIVE_PATH_PATTERN.test(sheet)) {
    fail(
      "INVALID_THEME_STYLESHEET",
      "theme.optionalStylesheet must be a strictly relative path (cannot be a Windows drive path)",
    );
  }

  if (sheet.startsWith("/") || sheet.startsWith("\\")) {
    fail(
      "INVALID_THEME_STYLESHEET",
      "theme.optionalStylesheet must be a strictly relative path (cannot start with / or \\)",
    );
  }

  if (sheet.includes("://")) {
    fail(
      "INVALID_THEME_STYLESHEET",
      "theme.optionalStylesheet must be a relative path without protocol (://)",
    );
  }

  if (sheet.includes("..")) {
    fail(
      "INVALID_THEME_STYLESHEET",
      "theme.optionalStylesheet must be a relative path without parent traversal (..)",
    );
  }
}

export function assertWorkspaceThemeContract(theme: unknown): asserts theme is WorkspaceThemeContract {
  if (!isPlainObject(theme)) {
    fail("INVALID_THEME_ID", "theme must be a plain object");
  }

  if (typeof theme.id !== "string" || theme.id.length === 0 || !THEME_ID_PATTERN.test(theme.id)) {
    fail("INVALID_THEME_ID", "theme.id must be a non-empty ASCII slug ([a-z0-9-])");
  }

  if (typeof theme.version !== "number" || !Number.isFinite(theme.version) || theme.version < 0) {
    fail("INVALID_THEME_VERSION", "theme.version must be a finite number >= 0");
  }

  normalizeAndValidateCssMap(theme.cssVariables, {
    maxVariables: MAX_THEME_CSS_VARIABLES,
    maxValueLength: MAX_THEME_CSS_VALUE_LENGTH,
    keyPattern: THEME_CSS_KEY_PATTERN,
    normalizeKey: normalizeThemeCssKey,
    pathPrefix: "theme.cssVariables",
  });

  if (theme.optionalStylesheet !== undefined) {
    if (typeof theme.optionalStylesheet !== "string") {
      fail("INVALID_THEME_STYLESHEET", "theme.optionalStylesheet must be a non-empty string");
    }
    assertOptionalStylesheetPathIsStrictlyRelative(theme.optionalStylesheet);
  }
}
