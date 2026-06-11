import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

/**
 * Dev/provision defaults for `tenants.theme` keyed by workspace_type.
 * Product-specific literals live here (not workspace-sdk — P5-T04 product-neutral core).
 *
 * @see docs/phase-4/subphases/4.4-tenant-theme.md
 */
export const DEFAULT_TENANT_BRANDING_BY_WORKSPACE_TYPE = Object.freeze({
  starter: Object.freeze({
    primaryColor: "#2563eb",
    cssVariables: Object.freeze({ "--color-primary": "#2563eb" }),
  }),
  denali: Object.freeze({
    primaryColor: "#0f766e",
    cssVariables: Object.freeze({ "--color-primary": "#0f766e" }),
  }),
  urban: Object.freeze({
    primaryColor: "#0d9488",
    cssVariables: Object.freeze({ "--color-primary": "#0d9488" }),
  }),
} satisfies Readonly<Record<string, TenantThemeConfig>>);

export function resolveDefaultTenantBranding(workspaceType: string): TenantThemeConfig {
  const key = workspaceType.trim().toLowerCase();
  const preset =
    DEFAULT_TENANT_BRANDING_BY_WORKSPACE_TYPE[
      key as keyof typeof DEFAULT_TENANT_BRANDING_BY_WORKSPACE_TYPE
    ];
  if (preset === undefined) {
    return {};
  }
  return {
    ...(preset.primaryColor !== undefined ? { primaryColor: preset.primaryColor } : {}),
    ...(preset.cssVariables !== undefined
      ? { cssVariables: { ...preset.cssVariables } }
      : {}),
  };
}
