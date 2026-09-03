import type { TenantThemeConfig } from "@app-tour/workspace-sdk";

function readStringArray(
  record: Record<string, unknown>,
  key: string
): readonly string[] | undefined {
  const raw = record[key] ?? record[key === "enabledModules" ? "enabled_modules" : key];
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const values = raw.filter((entry): entry is string => typeof entry === "string");
  return values.length > 0 ? values : undefined;
}

/**
 * Merge Postgres capability fields into tenant-config branding theme.
 * Branding fields are already normalized; module/commerce keys are copied from raw JSON.
 */
export function mergeTenantConfigSurfaceTheme(
  brandingTheme: TenantThemeConfig,
  rawTheme: unknown
): TenantThemeConfig {
  if (rawTheme === null || typeof rawTheme !== "object") {
    return brandingTheme;
  }

  const record = rawTheme as Record<string, unknown>;
  const enabledModules = readStringArray(record, "enabledModules");
  const portalModuleGrants = readStringArray(record, "portalModuleGrants");
  const commerce =
    record.commerce !== null && typeof record.commerce === "object" ? record.commerce : undefined;

  if (enabledModules === undefined && portalModuleGrants === undefined && commerce === undefined) {
    return brandingTheme;
  }

  return {
    ...brandingTheme,
    ...(enabledModules !== undefined ? { enabledModules } : {}),
    ...(portalModuleGrants !== undefined ? { portalModuleGrants } : {}),
    ...(commerce !== undefined ? { commerce } : {}),
  } as TenantThemeConfig;
}
