/**
 * Denali settings hub fallbacks when a stale API omits required modules
 * (e.g. integration gate blocked `integrations` before restart).
 * Curated subset of `denali-settings.manifest.ts` — keep ids in sync with hub recovery policy.
 *
 * Required-module inventory is owned by the settings manifest (Phase 3c); re-exported here so
 * the shell settings-hub binder can dynamic-import one surface for policy + fallbacks.
 */
import type { SettingsModuleManifest } from "@app-tour/workspace-sdk";

export { DENALI_BACKEND_REQUIRED_MODULE_IDS } from "./denali-settings.manifest";

export type DenaliFallbackSettingsModule = Pick<
  SettingsModuleManifest,
  "id" | "kind" | "route" | "ability" | "nav"
>;

export const DENALI_FALLBACK_SETTINGS_MODULES: Readonly<
  Record<string, DenaliFallbackSettingsModule>
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
