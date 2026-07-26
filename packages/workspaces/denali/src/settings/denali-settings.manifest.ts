/**
 * Phase 9.6 — Denali settings module inventory (DEC-P9-009).
 * @see docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md §7
 */
import {
  validateSettingsManifest,
  type OperatorSettingsSurface,
  type SettingsModuleManifest,
} from "@app-tour/workspace-sdk";

const DENALI_SETTINGS_MODULES = Object.freeze([
  Object.freeze({
    id: "workspace_branding",
    kind: "readonly_explorer",
    route: "settings/branding",
    ability: "operator.settings.workspace_branding",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.workspace_branding" }),
  }),
  Object.freeze({
    id: "integrations",
    kind: "readonly_explorer",
    route: "settings/integrations",
    ability: "operator.settings.integrations",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.integrations" }),
  }),
  Object.freeze({
    id: "exposure",
    kind: "readonly_explorer",
    route: "settings/exposure",
    ability: "operator.settings.exposure",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.exposure" }),
  }),
  Object.freeze({
    id: "equipment",
    kind: "reference_data",
    route: "settings/equipment",
    ability: "operator.settings.equipment",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.equipment" }),
    entity: "WorkspaceEquipment",
  }),
  Object.freeze({
    id: "guide_languages",
    kind: "reference_data",
    route: "settings/guide-languages",
    ability: "operator.settings.guide_languages",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.guide_languages" }),
    entity: "WorkspaceGuideLanguage",
  }),
  Object.freeze({
    id: "tour_themes",
    kind: "reference_data",
    route: "settings/tour-themes",
    ability: "operator.settings.tour_themes",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.tour_themes" }),
    entity: "WorkspaceTourTheme",
  }),
  Object.freeze({
    id: "locations",
    kind: "reference_data",
    route: "settings/locations",
    ability: "operator.settings.locations",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.locations" }),
    entity: "WorkspaceRegion",
  }),
  Object.freeze({
    id: "tour_presets",
    kind: "reference_data",
    route: "settings/tour-presets",
    ability: "operator.settings.tour_presets",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.tour_presets" }),
    entity: "WorkspaceTourPreset",
  }),
  Object.freeze({
    id: "tour_wizard_template",
    kind: "tenant_config",
    route: "settings/tour-wizard-template",
    ability: "operator.settings.tour_wizard_template",
    nav: Object.freeze({ group: "templates", labelKey: "settings.tour_wizard_template" }),
    configKey: "wizard_template",
    configVersion: 1,
  }),
  Object.freeze({
    id: "wizard_drafts",
    kind: "readonly_explorer",
    route: "settings/wizard-drafts",
    ability: "operator.settings.wizard_drafts",
    nav: Object.freeze({ group: "templates", labelKey: "settings.wizard_drafts" }),
  }),
  Object.freeze({
    id: "tour_presets_advanced",
    kind: "tenant_config",
    route: "settings/tour-presets/advanced",
    ability: "operator.settings.tour_presets_advanced",
    nav: Object.freeze({ group: "templates", labelKey: "settings.tour_presets_advanced" }),
    configKey: "presets_advanced",
    configVersion: 1,
  }),
  Object.freeze({
    id: "audit_trail",
    kind: "readonly_explorer",
    route: "settings/audit-trail",
    ability: "operator.settings.audit_trail",
    nav: Object.freeze({ group: "finance_ops", labelKey: "settings.audit_trail" }),
  }),
] as const satisfies readonly SettingsModuleManifest[]);

validateSettingsManifest(DENALI_SETTINGS_MODULES);

/** Hub consistency: backend must surface these module ids (order = manifest inventory). */
export const DENALI_BACKEND_REQUIRED_MODULE_IDS = Object.freeze(
  DENALI_SETTINGS_MODULES.map((module) => module.id)
);

export const denaliOperatorSettingsSurface = Object.freeze({
  manifestVersion: 1 as const,
  modules: DENALI_SETTINGS_MODULES,
}) satisfies OperatorSettingsSurface;

export function getDenaliOperatorSettingsSurface(): OperatorSettingsSurface {
  return denaliOperatorSettingsSurface;
}
