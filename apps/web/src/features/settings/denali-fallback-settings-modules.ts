import type { SettingsModuleMetadata } from "./settings-module-types";

/**
 * Denali manifest fallbacks when a stale API omits required settings modules
 * (e.g. integration gate blocked `integrations` before restart).
 * Keep in sync with `packages/workspaces/denali/src/settings/denali-settings.manifest.ts`.
 */
export const DENALI_FALLBACK_SETTINGS_MODULES: Readonly<
  Record<string, SettingsModuleMetadata>
> = Object.freeze({
  workspace_branding: Object.freeze({
    id: "workspace_branding",
    kind: "readonly_explorer",
    route: "settings/branding",
    ability: "operator.settings.workspace_branding",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.workspace_branding" }),
  }),
  integrations: Object.freeze({
    id: "integrations",
    kind: "readonly_explorer",
    route: "settings/integrations",
    ability: "operator.settings.integrations",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.integrations" }),
  }),
  exposure: Object.freeze({
    id: "exposure",
    kind: "readonly_explorer",
    route: "settings/exposure",
    ability: "operator.settings.exposure",
    nav: Object.freeze({ group: "workspace", labelKey: "settings.exposure" }),
  }),
});
