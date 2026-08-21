import type { SettingsModuleManifest } from "@app-tour/workspace-sdk";

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

export class SettingsModuleUnknownError extends Error {
  readonly code = "SETTINGS_MODULE_UNKNOWN" as const;

  constructor(readonly moduleId: string) {
    super(`SETTINGS_MODULE_UNKNOWN:${moduleId}`);
    this.name = "SettingsModuleUnknownError";
  }
}

export async function listSettingsModuleMetadataForTenant(
  tenantId: string
): Promise<readonly SettingsModuleManifest[]> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = await resolveWorkspacePluginForType(workspaceType);
  const modules = plugin.operatorSettings?.modules;
  return modules ?? [];
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

export async function resolveEquipmentIconKeyValidatorForTenant(
  tenantId: string
): Promise<((value: string) => boolean) | undefined> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = await resolveWorkspacePluginForType(workspaceType);
  return plugin.operatorSettings?.validateEquipmentIconKey;
}
