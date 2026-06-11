import type { TenantBrandLogo } from "./tenant-brand-logo";

/** Guest/marketing UI locale stored on tenant theme (M13). */
export type TenantDefaultLocale = "fa" | "en";

/** Tenant-scoped visual branding (platform CSS variables; full kernel in phase 4). */
export type TenantThemeConfig = {
  readonly primaryColor?: string;
  readonly cssVariables?: Readonly<Record<string, string>>;
  /** Organization display name — sidebar, login, wizard bridge. */
  readonly displayName?: string;
  /** MinIO object reference — render via signed URL, not CSS. */
  readonly logo?: TenantBrandLogo;
  /** Default marketing/portal locale when user has no locale cookie. */
  readonly defaultLocale?: TenantDefaultLocale;
};
