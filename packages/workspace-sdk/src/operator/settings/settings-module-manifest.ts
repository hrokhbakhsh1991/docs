/**
 * Phase 9.6 — Settings module registry types (DEC-P9-009).
 * @see docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md §3
 */

export type SettingsModuleKind =
  | "reference_data"
  | "tenant_config"
  | "readonly_explorer"
  | "account_preference";

export type SettingsNavGroup = "account" | "workspace" | "templates" | "finance_ops";

const SETTINGS_MODULE_KINDS: readonly SettingsModuleKind[] = [
  "reference_data",
  "tenant_config",
  "readonly_explorer",
  "account_preference",
] as const;

export type SettingsModuleManifest = {
  readonly id: string;
  readonly kind: SettingsModuleKind;
  readonly route: string;
  readonly ability: string;
  readonly nav: {
    readonly group: SettingsNavGroup;
    readonly labelKey: string;
  };
  readonly entity?: string;
  readonly configKey?: string;
  readonly configVersion?: number;
};

export type OperatorSettingsSurface = {
  readonly manifestVersion: 1;
  readonly modules: readonly SettingsModuleManifest[];
  readonly validateEquipmentIconKey?: (value: string) => boolean;
};

function isSettingsModuleKind(value: string): value is SettingsModuleKind {
  return (SETTINGS_MODULE_KINDS as readonly string[]).includes(value);
}

/** Fail closed on unknown module kinds before registry Map construction (R-P9-S07). */
export function validateSettingsManifest(modules: readonly SettingsModuleManifest[]): void {
  for (const module of modules) {
    if (!isSettingsModuleKind(module.kind)) {
      throw new Error(`SETTINGS_MODULE_UNKNOWN_KIND:${module.kind}`);
    }
  }
}
