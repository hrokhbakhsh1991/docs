import type { SettingsModuleMetadata, SettingsNavGroup } from "./settings-module-types";
import {
  SETTINGS_MODULE_DESCRIPTION_KEYS,
  SETTINGS_MODULE_KIND_KEYS,
  SETTINGS_MODULE_LABEL_KEYS,
  SETTINGS_NAV_GROUP_KEYS,
} from "./settings-module-types";

const NAV_GROUP_ORDER: readonly SettingsNavGroup[] = [
  "account",
  "workspace",
  "templates",
  "finance_ops",
] as const;

export function labelKeyForSettingsModule(module: SettingsModuleMetadata): string {
  return SETTINGS_MODULE_LABEL_KEYS[module.id] ?? module.id;
}

/** @deprecated Use `labelKeyForSettingsModule` with next-intl in UI. */
export function labelForSettingsModule(module: SettingsModuleMetadata): string {
  return labelKeyForSettingsModule(module);
}

export function descriptionKeyForSettingsModule(module: SettingsModuleMetadata): string | null {
  return SETTINGS_MODULE_DESCRIPTION_KEYS[module.id] ?? null;
}

/** @deprecated Use `descriptionKeyForSettingsModule` with next-intl in UI. */
export function descriptionForSettingsModule(module: SettingsModuleMetadata): string | null {
  return descriptionKeyForSettingsModule(module);
}

export function kindLabelKeyForSettingsModule(module: SettingsModuleMetadata): string {
  return SETTINGS_MODULE_KIND_KEYS[module.kind] ?? module.kind;
}

/** @deprecated Use `kindLabelKeyForSettingsModule` with next-intl in UI. */
export function kindLabelForSettingsModule(module: SettingsModuleMetadata): string {
  return kindLabelKeyForSettingsModule(module);
}

export function hrefForSettingsModule(module: SettingsModuleMetadata): string {
  return `/${module.route}`;
}

export function groupSettingsModulesByNav(
  modules: readonly SettingsModuleMetadata[]
): Array<{ group: SettingsNavGroup; labelKey: string; modules: SettingsModuleMetadata[] }> {
  const grouped = new Map<SettingsNavGroup, SettingsModuleMetadata[]>();
  for (const module of modules) {
    const list = grouped.get(module.nav.group) ?? [];
    list.push(module);
    grouped.set(module.nav.group, list);
  }
  return NAV_GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => ({
    group,
    labelKey: SETTINGS_NAV_GROUP_KEYS[group],
    modules: grouped.get(group) ?? [],
  }));
}

export function isEquipmentModuleSupported(moduleId: string): boolean {
  return moduleId === "equipment";
}

export function isWizardTemplateModuleSupported(moduleId: string): boolean {
  return moduleId === "tour_wizard_template";
}

export function isAuditTrailModuleSupported(moduleId: string): boolean {
  return moduleId === "audit_trail";
}

export function isTourThemesModuleSupported(moduleId: string): boolean {
  return moduleId === "tour_themes";
}

export function isLocationsModuleSupported(moduleId: string): boolean {
  return moduleId === "locations";
}

export function isGuideLanguagesModuleSupported(moduleId: string): boolean {
  return moduleId === "guide_languages";
}

export function isTourPresetsModuleSupported(moduleId: string): boolean {
  return moduleId === "tour_presets";
}

export function isTourPresetsAdvancedModuleSupported(moduleId: string): boolean {
  return moduleId === "tour_presets_advanced";
}

export function isSettingsPilotModule(moduleId: string): boolean {
  return (
    isEquipmentModuleSupported(moduleId) ||
    isWizardTemplateModuleSupported(moduleId) ||
    isAuditTrailModuleSupported(moduleId) ||
    isTourThemesModuleSupported(moduleId) ||
    isLocationsModuleSupported(moduleId) ||
    isGuideLanguagesModuleSupported(moduleId) ||
    isTourPresetsModuleSupported(moduleId) ||
    isTourPresetsAdvancedModuleSupported(moduleId)
  );
}
