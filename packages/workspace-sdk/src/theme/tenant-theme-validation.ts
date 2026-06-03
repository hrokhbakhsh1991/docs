import {
  throwWorkspaceValidationError,
  WorkspaceThemeValidationError,
  type WorkspaceThemeValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import { sdkErr, type SdkResult } from "../errors/sdk-result.js";
import { normalizeAndValidateCssMap } from "./css-map-validation";
import { assertThemeCssValueIsSafe } from "./theme-css-value-safety";
import { normalizeTenantCssKey } from "./normalize-tenant-css-key";
import { sealTenantTheme, type SealedTenantTheme } from "./theme-safety-seal";
import type { TenantThemeConfig } from "./tenant-theme.contract";

const MAX_TENANT_CSS_VARIABLES = 64;
const MAX_TENANT_CSS_VALUE_LENGTH = 4096;
const MAX_PRIMARY_COLOR_LENGTH = 4096;
const TENANT_CSS_KEY_PATTERN = /^--color-[a-z0-9-]+$/;

function fail(code: WorkspaceThemeValidationErrorCode, message: string): never {
  throwWorkspaceValidationError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertPrimaryColor(rawValue: unknown): string {
  if (typeof rawValue !== "string") {
    fail("INVALID_THEME_CSS_VALUE", "tenant.primaryColor must be a string");
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    fail("INVALID_THEME_CSS_VALUE", "tenant.primaryColor must be non-empty");
  }

  if (trimmed.length > MAX_PRIMARY_COLOR_LENGTH) {
    fail("INVALID_THEME_CSS_VALUE", "tenant.primaryColor exceeds max length");
  }

  assertThemeCssValueIsSafe("primaryColor", trimmed);
  return trimmed;
}

/**
 * Validates and returns a sanitized tenant theme for DOM injection.
 * Applies the same CSS value safety rules as workspace theme ingress.
 */
export function validateTenantTheme(theme: unknown): SealedTenantTheme {
  if (!isPlainObject(theme)) {
    fail("TENANT_INVALID_SHAPE", "tenant theme must be a plain object");
  }

  const result: { primaryColor?: string; cssVariables?: Record<string, string> } = {};

  if (theme.primaryColor !== undefined) {
    result.primaryColor = assertPrimaryColor(theme.primaryColor);
  }

  if (theme.cssVariables !== undefined) {
    const sanitized = normalizeAndValidateCssMap(theme.cssVariables, {
      maxVariables: MAX_TENANT_CSS_VARIABLES,
      maxValueLength: MAX_TENANT_CSS_VALUE_LENGTH,
      keyPattern: TENANT_CSS_KEY_PATTERN,
      normalizeKey: (rawKey) => {
        const normalized = normalizeTenantCssKey(rawKey);
        if (!normalized) {
          fail(
            "INVALID_THEME_CSS_KEY",
            `tenant.cssVariables["${rawKey}"] must be a platform key (--color-*, not --ws-*)`,
          );
        }
        return normalized;
      },
      pathPrefix: "tenant.cssVariables",
    });
    if (Object.keys(sanitized).length > 0) {
      result.cssVariables = sanitized;
    }
  }

  const frozen =
    Object.keys(result).length > 0
      ? (Object.freeze(result) as TenantThemeConfig)
      : (Object.freeze({}) as TenantThemeConfig);

  if (frozen.cssVariables) {
    Object.freeze(frozen.cssVariables);
  }

  return sealTenantTheme(frozen);
}

export function tryValidateTenantTheme(
  theme: unknown,
): SdkResult<SealedTenantTheme, WorkspaceThemeValidationErrorCode> {
  try {
    return { ok: true, value: validateTenantTheme(theme) };
  } catch (error: unknown) {
    if (error instanceof WorkspaceThemeValidationError) {
      return sdkErr(error.code, error.message);
    }
    return sdkErr("TENANT_INVALID_SHAPE", error instanceof Error ? error.message : String(error));
  }
}
