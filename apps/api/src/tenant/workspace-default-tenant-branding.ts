import { DEFAULT_WORKSPACE_TYPE_BINDINGS, type TenantThemeConfig } from "@app-tour/workspace-sdk";

/**
 * Dev/provision defaults for `tenants.theme` keyed by workspace_type.
 * Product-specific literals come from workspace manifests via generated bindings.
 *
 * @see docs/phase-4/subphases/4.4-tenant-theme.md
 */
const BRANDING_BY_WORKSPACE_TYPE = new Map(
  DEFAULT_WORKSPACE_TYPE_BINDINGS.map((binding) => [
    binding.workspaceType,
    binding.tenantBrandingDefaults,
  ])
);

export function resolveDefaultTenantBranding(workspaceType: string): TenantThemeConfig {
  const key = workspaceType.trim().toLowerCase();
  const defaults = BRANDING_BY_WORKSPACE_TYPE.get(key);
  if (defaults === undefined) {
    return {};
  }
  return {
    ...defaults,
    ...(defaults.cssVariables !== undefined ? { cssVariables: { ...defaults.cssVariables } } : {}),
  };
}
