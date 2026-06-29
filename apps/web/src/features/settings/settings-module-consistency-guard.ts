import type { SettingsModuleMetadata } from "./settings-module-types";
import { DENALI_BACKEND_REQUIRED_MODULE_IDS } from "./denali-required-settings-modules.generated";
import { DENALI_FALLBACK_SETTINGS_MODULES } from "./denali-fallback-settings-modules";

export { DENALI_BACKEND_REQUIRED_MODULE_IDS };

export type SettingsModuleConsistencyResult = {
  readonly modules: SettingsModuleMetadata[];
  readonly desyncDetected: boolean;
  readonly missingFromBackend: readonly string[];
};

function manifestIndexForModule(moduleId: string): number {
  const index = DENALI_BACKEND_REQUIRED_MODULE_IDS.indexOf(
    moduleId as (typeof DENALI_BACKEND_REQUIRED_MODULE_IDS)[number]
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function injectMissingDenaliModules(
  backendModules: readonly SettingsModuleMetadata[],
  missingIds: readonly string[]
): SettingsModuleMetadata[] {
  const result = [...backendModules];
  const presentIds = new Set(result.map((module) => module.id));

  for (const missingId of missingIds) {
    const fallback = DENALI_FALLBACK_SETTINGS_MODULES[missingId];
    if (fallback === undefined || presentIds.has(missingId)) {
      continue;
    }

    const missingIndex = manifestIndexForModule(missingId);
    let insertAt = result.length;
    for (let index = 0; index < result.length; index += 1) {
      const candidateIndex = manifestIndexForModule(result[index]?.id ?? "");
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
 * If Denali declares settings modules that the API registry omits, inject manifest fallbacks
 * so the hub keeps linking to connection pages during migration drift or stale API processes.
 * Logs CONSISTENCY_UI_DESYNC when mismatch is detected.
 */
export function guardSettingsModulesAgainstBackend(
  backendModules: readonly SettingsModuleMetadata[],
  pluginId: string
): SettingsModuleConsistencyResult {
  if (pluginId !== "denali") {
    return { modules: [...backendModules], desyncDetected: false, missingFromBackend: [] };
  }

  const backendIds = new Set(backendModules.map((module) => module.id));
  const missingFromBackend = DENALI_BACKEND_REQUIRED_MODULE_IDS.filter((id) => !backendIds.has(id));
  if (missingFromBackend.length === 0) {
    return { modules: [...backendModules], desyncDetected: false, missingFromBackend: [] };
  }

  return {
    modules: injectMissingDenaliModules(backendModules, missingFromBackend),
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
