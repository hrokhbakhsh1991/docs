import type { SettingsModuleMetadata } from "./settings-module-types";
import { resolveSettingsHubFallbackPolicy } from "@/features/settings/settings-hub-fallback-registry";

export type SettingsModuleConsistencyResult = {
  readonly modules: SettingsModuleMetadata[];
  readonly desyncDetected: boolean;
  readonly missingFromBackend: readonly string[];
};

function manifestIndexForModule(moduleId: string, requiredModuleIds: readonly string[]): number {
  const index = requiredModuleIds.indexOf(moduleId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function injectMissingSettingsModules(
  backendModules: readonly SettingsModuleMetadata[],
  missingIds: readonly string[],
  requiredModuleIds: readonly string[],
  fallbackModules: Readonly<Record<string, SettingsModuleMetadata>>
): SettingsModuleMetadata[] {
  const result = [...backendModules];
  const presentIds = new Set(result.map((module) => module.id));

  for (const missingId of missingIds) {
    const fallback = fallbackModules[missingId];
    if (fallback === undefined || presentIds.has(missingId)) {
      continue;
    }

    const missingIndex = manifestIndexForModule(missingId, requiredModuleIds);
    let insertAt = result.length;
    for (let index = 0; index < result.length; index += 1) {
      const candidateIndex = manifestIndexForModule(result[index]?.id ?? "", requiredModuleIds);
      if (candidateIndex > missingIndex) {
        insertAt = index;
        break;
      }
    }
    result.splice(insertAt, 0, fallback);
    presentIds.add(missingId);
  }

  return result;
}

/**
 * When a workspace manifest declares settings hub fallback, inject required module
 * metadata when the API registry omits entries during migration drift.
 * Logs CONSISTENCY_UI_DESYNC when mismatch is detected.
 */
export function guardSettingsModulesAgainstBackend(
  backendModules: readonly SettingsModuleMetadata[],
  pluginId: string
): SettingsModuleConsistencyResult {
  const policy = resolveSettingsHubFallbackPolicy(pluginId);
  if (policy == null) {
    return { modules: [...backendModules], desyncDetected: false, missingFromBackend: [] };
  }

  const backendIds = new Set(backendModules.map((module) => module.id));
  const missingFromBackend = policy.requiredModuleIds.filter((id) => !backendIds.has(id));
  if (missingFromBackend.length === 0) {
    return { modules: [...backendModules], desyncDetected: false, missingFromBackend: [] };
  }

  return {
    modules: injectMissingSettingsModules(
      backendModules,
      missingFromBackend,
      policy.requiredModuleIds,
      policy.fallbackModules
    ),
    desyncDetected: true,
    missingFromBackend,
  };
}

export function logSettingsModuleUiDesync(input: {
  readonly pluginId: string;
  readonly missingFromBackend: readonly string[];
}): void {
  console.warn("CONSISTENCY_UI_DESYNC", {
    message: "UI-BACKEND DESYNC DETECTED",
    pluginId: input.pluginId,
    missingFromBackend: input.missingFromBackend,
    timestamp: new Date().toISOString(),
  });
}
