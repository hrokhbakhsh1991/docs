import { TENANT_MODULE_IDS, type TenantModuleId } from "@repo/shared";

/** Normalizes `tenants.enabled_modules` jsonb. */
export function parseTenantEnabledModules(value: unknown): TenantModuleId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowed = new Set<string>(TENANT_MODULE_IDS);
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s): s is TenantModuleId => allowed.has(s));
}
