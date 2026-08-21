import type { TenantThemeConfig } from "./tenant-theme.contract";

export function isTenantBrandingEmpty(theme: TenantThemeConfig): boolean {
  const primary = theme.primaryColor?.trim();
  if (primary !== undefined && primary.length > 0) {
    return false;
  }
  const displayName = theme.displayName?.trim();
  const displayNameFa = theme.displayNameFa?.trim();
  const displayNameEn = theme.displayNameEn?.trim();
  if (
    (displayName !== undefined && displayName.length > 0) ||
    (displayNameFa !== undefined && displayNameFa.length > 0) ||
    (displayNameEn !== undefined && displayNameEn.length > 0)
  ) {
    return false;
  }
  const logoKey = theme.logo?.storageKey?.trim();
  if (logoKey !== undefined && logoKey.length > 0) {
    return false;
  }
  const css = theme.cssVariables;
  if (css === undefined) {
    return true;
  }
  return !Object.values(css).some((value) => typeof value === "string" && value.trim().length > 0);
}

/**
 * Merge persisted tenant branding with a caller-supplied default (SaaS white-label pattern).
 * Stored non-empty values win; empty `{}` inherits `fallback`.
 */
export function resolveEffectiveTenantBranding(
  stored: TenantThemeConfig,
  fallback: TenantThemeConfig
): TenantThemeConfig {
  if (isTenantBrandingEmpty(stored)) {
    if (isTenantBrandingEmpty(fallback)) {
      return {};
    }
    return {
      ...(fallback.primaryColor !== undefined ? { primaryColor: fallback.primaryColor } : {}),
      ...(fallback.cssVariables !== undefined
        ? { cssVariables: { ...fallback.cssVariables } }
        : {}),
      ...(fallback.displayName !== undefined ? { displayName: fallback.displayName } : {}),
      ...(fallback.displayNameFa !== undefined ? { displayNameFa: fallback.displayNameFa } : {}),
      ...(fallback.displayNameEn !== undefined ? { displayNameEn: fallback.displayNameEn } : {}),
      ...(fallback.logo !== undefined ? { logo: { ...fallback.logo } } : {}),
      ...(fallback.defaultLocale !== undefined ? { defaultLocale: fallback.defaultLocale } : {}),
    };
  }
  return {
    ...stored,
    ...(stored.defaultLocale === undefined && fallback.defaultLocale !== undefined
      ? { defaultLocale: fallback.defaultLocale }
      : {}),
  };
}
