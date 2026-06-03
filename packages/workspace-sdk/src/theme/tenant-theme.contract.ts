/** Tenant-scoped visual branding (platform CSS variables; full kernel in phase 4). */
export type TenantThemeConfig = {
  readonly primaryColor?: string;
  readonly cssVariables?: Readonly<Record<string, string>>;
};
