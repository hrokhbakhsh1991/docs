import type { TenantBrandLogo } from "./tenant-brand-logo";

/** Guest/marketing UI locale stored on tenant theme (M13). */
export type TenantDefaultLocale = "fa" | "en";

/** Tenant-scoped visual branding (platform CSS variables; full kernel in phase 4). */
export type TenantThemeConfig = {
  readonly primaryColor?: string;
  readonly cssVariables?: Readonly<Record<string, string>>;
  /** Legacy organization display name — kept for backward compatibility during migration. */
  readonly displayName?: string;
  /** Localized organization display name for Persian UI surfaces. */
  readonly displayNameFa?: string;
  /** Localized organization display name for English UI surfaces. */
  readonly displayNameEn?: string;
  /** MinIO object reference — render via signed URL, not CSS. */
  readonly logo?: TenantBrandLogo;
  /** Default marketing/portal locale when user has no locale cookie. */
  readonly defaultLocale?: TenantDefaultLocale;
};
