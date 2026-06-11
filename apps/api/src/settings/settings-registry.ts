import type { SettingsModuleManifest } from "@app-tour/workspace-sdk";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

export class SettingsModuleUnknownError extends Error {
  readonly code = "SETTINGS_MODULE_UNKNOWN" as const;

  constructor(readonly moduleId: string) {
    super(`SETTINGS_MODULE_UNKNOWN:${moduleId}`);
    this.name = "SettingsModuleUnknownError";
  }
}

function listDenaliFallbackSettingsModules(): readonly SettingsModuleManifest[] {
  return getDenaliWorkspacePlugin().operatorSettings?.modules ?? [];
}

export async function listSettingsModuleMetadataForTenant(
  tenantId: string
): Promise<readonly SettingsModuleManifest[]> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = resolveWorkspacePluginForType(workspaceType);
  const modules = plugin.operatorSettings?.modules;
  if (modules !== undefined && modules.length > 0) {
    return modules;
  }
  if (workspaceType === "denali") {
    return listDenaliFallbackSettingsModules();
  }
  return [];
}

export async function resolveSettingsModuleForTenant(
  tenantId: string,
  moduleId: string
): Promise<SettingsModuleManifest> {
  const module = (await listSettingsModuleMetadataForTenant(tenantId)).find(
    (entry) => entry.id === moduleId
  );
  if (module === undefined) {
    throw new SettingsModuleUnknownError(moduleId);
  }
  return module;
}

export class SettingsConfigUnknownError extends Error {
  readonly code = "SETTINGS_CONFIG_UNKNOWN" as const;

  constructor(readonly configKey: string) {
    super(`SETTINGS_CONFIG_UNKNOWN:${configKey}`);
    this.name = "SettingsConfigUnknownError";
  }
}

export async function resolveSettingsModuleByConfigKeyForTenant(
  tenantId: string,
  configKey: string
): Promise<SettingsModuleManifest> {
  const module = (await listSettingsModuleMetadataForTenant(tenantId)).find(
    (entry) => entry.kind === "tenant_config" && entry.configKey === configKey
  );
  if (module === undefined) {
    throw new SettingsConfigUnknownError(configKey);
  }
  return module;
}

/** @deprecated Use {@link listSettingsModuleMetadataForTenant} — denali fallback for legacy sync callers. */
export function listSettingsModuleMetadata(): readonly SettingsModuleManifest[] {
  return listDenaliFallbackSettingsModules();
}

/** @deprecated Use {@link resolveSettingsModuleForTenant}. */
export function resolveSettingsModule(moduleId: string): SettingsModuleManifest {
  const module = listDenaliFallbackSettingsModules().find((entry) => entry.id === moduleId);
  if (module === undefined) {
    throw new SettingsModuleUnknownError(moduleId);
  }
  return module;
}

/** @deprecated Use {@link resolveSettingsModuleByConfigKeyForTenant}. */
export function resolveSettingsModuleByConfigKey(configKey: string): SettingsModuleManifest {
  const module = listDenaliFallbackSettingsModules().find(
    (entry) => entry.kind === "tenant_config" && entry.configKey === configKey
  );
  if (module === undefined) {
    throw new SettingsConfigUnknownError(configKey);
  }
  return module;
}
