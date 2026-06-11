/**
 * Phase 9.6 W8 — Starter settings module inventory (wizard template only).
 * @see docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md §3.14
 */
import {
  validateSettingsManifest,
  type OperatorSettingsSurface,
  type SettingsModuleManifest,
} from "../operator/settings/settings-module-manifest";

const STARTER_SETTINGS_MODULES = Object.freeze([
  Object.freeze({
    id: "workspace_branding",
    kind: "readonly_explorer",
    route: "settings/branding",
    ability: "operator.settings.workspace_branding",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.workspace_branding" }),
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
] as const satisfies readonly SettingsModuleManifest[]);

validateSettingsManifest(STARTER_SETTINGS_MODULES);

export const starterOperatorSettingsSurface = Object.freeze({
  manifestVersion: 1 as const,
  modules: STARTER_SETTINGS_MODULES,
}) satisfies OperatorSettingsSurface;

export function getStarterOperatorSettingsSurface(): OperatorSettingsSurface {
  return starterOperatorSettingsSurface;
}
