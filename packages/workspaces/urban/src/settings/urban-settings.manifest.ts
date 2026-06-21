/**
 * Phase 15 / P15-P-B1 — Urban operator settings manifest (wizard template only).
 */
import {
  validateSettingsManifest,
  type OperatorSettingsSurface,
  type SettingsModuleManifest,
} from "@app-tour/workspace-sdk";

const URBAN_SETTINGS_MODULES = Object.freeze([
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

validateSettingsManifest(URBAN_SETTINGS_MODULES);

export const urbanOperatorSettingsSurface = Object.freeze({
  manifestVersion: 1 as const,
  modules: URBAN_SETTINGS_MODULES,
}) satisfies OperatorSettingsSurface;

export function getUrbanOperatorSettingsSurface(): OperatorSettingsSurface {
  return urbanOperatorSettingsSurface;
}
