import type { TenantDefaultLocale, TenantThemeConfig } from "./tenant-theme.contract";

export type TenantBrandingDisplayNameSource = Pick<
  TenantThemeConfig,
  "displayName" | "displayNameFa" | "displayNameEn"
>;

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function resolveBrandingDisplayNameParts(
  source: TenantBrandingDisplayNameSource
): {
  readonly fa: string | null;
  readonly en: string | null;
  readonly legacy: string | null;
} {
  return {
    fa: trimToNull(source.displayNameFa),
    en: trimToNull(source.displayNameEn),
    legacy: trimToNull(source.displayName),
  };
}

export function resolveTenantBrandingDisplayName(
  source: TenantBrandingDisplayNameSource | null | undefined,
  locale: TenantDefaultLocale,
  fallbackWorkspaceLabel?: string | null
): string {
  const parts = resolveBrandingDisplayNameParts(source ?? {});
  const fallback = trimToNull(fallbackWorkspaceLabel);
  const ordered =
    locale === "fa"
      ? [parts.fa, parts.en, parts.legacy, fallback]
      : [parts.en, parts.fa, parts.legacy, fallback];
  return ordered.find((value): value is string => value !== null) ?? "";
}
