import type { SettingsModuleMetadata } from "./settings-module-types";
import { DENALI_BACKEND_REQUIRED_MODULE_IDS } from "./denali-required-settings-modules.generated";

export { DENALI_BACKEND_REQUIRED_MODULE_IDS };

export type SettingsModuleConsistencyResult = {
  readonly modules: SettingsModuleMetadata[];
  readonly desyncDetected: boolean;
  readonly missingFromBackend: readonly string[];
};

/**
 * If Denali declares settings modules that the API registry omits, do not render them.
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

  const blocked = new Set<string>(missingFromBackend);
  return {
    modules: backendModules.filter((module) => !blocked.has(module.id)),
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
