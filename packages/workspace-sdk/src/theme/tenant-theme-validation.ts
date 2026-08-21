import {
  throwWorkspaceValidationError,
  WorkspaceThemeValidationError,
  type WorkspaceThemeValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import { sdkErr, type SdkResult } from "../errors/sdk-result.js";
import { normalizeAndValidateCssMap } from "./css-map-validation";
import { assertThemeCssValueIsSafe } from "./theme-css-value-safety";
import { normalizeTenantCssKey } from "./normalize-tenant-css-key";
import {
  isTenantBrandLogoContentType,
  isTenantBrandLogoStorageKey,
  type TenantBrandLogo,
} from "./tenant-brand-logo";
import { sealTenantTheme, type SealedTenantTheme } from "./theme-safety-seal";
import type { TenantDefaultLocale, TenantThemeConfig } from "./tenant-theme.contract";

const MAX_TENANT_DISPLAY_NAME_LENGTH = 80;

const MAX_TENANT_CSS_VARIABLES = 64;
const MAX_TENANT_CSS_VALUE_LENGTH = 4096;
const MAX_PRIMARY_COLOR_LENGTH = 4096;
const TENANT_CSS_KEY_PATTERN = /^--color-[a-z0-9-]+$/;
const TENANT_DEFAULT_LOCALES = new Set<TenantDefaultLocale>(["fa", "en"]);

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

function assertDisplayName(rawValue: unknown, fieldName: string): string {
  if (typeof rawValue !== "string") {
    fail("TENANT_INVALID_SHAPE", `tenant.${fieldName} must be a string`);
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    fail("TENANT_INVALID_SHAPE", `tenant.${fieldName} must be non-empty`);
  }
  if (trimmed.length > MAX_TENANT_DISPLAY_NAME_LENGTH) {
    fail("TENANT_INVALID_SHAPE", `tenant.${fieldName} exceeds max length`);
  }
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

  const result: {
    primaryColor?: string;
    cssVariables?: Record<string, string>;
    displayName?: string;
    displayNameFa?: string;
    displayNameEn?: string;
    logo?: TenantBrandLogo;
    defaultLocale?: TenantDefaultLocale;
  } = {};

  if (theme.primaryColor !== undefined) {
    result.primaryColor = assertPrimaryColor(theme.primaryColor);
  }

  if (theme.displayName !== undefined) {
    result.displayName = assertDisplayName(theme.displayName, "displayName");
  }

  if (theme.displayNameFa !== undefined) {
    result.displayNameFa = assertDisplayName(theme.displayNameFa, "displayNameFa");
  }

  if (theme.displayNameEn !== undefined) {
    result.displayNameEn = assertDisplayName(theme.displayNameEn, "displayNameEn");
  }

  if (theme.logo !== undefined) {
    if (!isPlainObject(theme.logo)) {
      fail("TENANT_INVALID_SHAPE", "tenant.logo must be an object");
    }
    const storageKey =
      typeof theme.logo.storageKey === "string" ? theme.logo.storageKey.trim() : "";
    if (!isTenantBrandLogoStorageKey(storageKey)) {
      fail("TENANT_INVALID_SHAPE", "tenant.logo.storageKey is invalid");
    }
    if (theme.logo.contentType !== undefined) {
      if (typeof theme.logo.contentType !== "string") {
        fail("TENANT_INVALID_SHAPE", "tenant.logo.contentType must be a string");
      }
      const contentType = theme.logo.contentType.trim().toLowerCase();
      if (!isTenantBrandLogoContentType(contentType)) {
        fail("TENANT_INVALID_SHAPE", "tenant.logo.contentType is invalid");
      }
      result.logo = { storageKey, contentType };
    } else {
      result.logo = { storageKey };
    }
  }

  if (theme.defaultLocale !== undefined) {
    if (typeof theme.defaultLocale !== "string") {
      fail("TENANT_INVALID_SHAPE", "tenant.defaultLocale must be a string");
    }
    const locale = theme.defaultLocale.trim() as TenantDefaultLocale;
    if (!TENANT_DEFAULT_LOCALES.has(locale)) {
      fail("TENANT_INVALID_SHAPE", "tenant.defaultLocale must be fa or en");
    }
    result.defaultLocale = locale;
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
