/**
 * Thin Shell Phase 4ao / 4bq — package-owned operator UI surface registry.
 * Wizard/plugin tsc stays free of static `src/ui` imports via string-keyed
 * dynamic import. After warm, surface is published on a product-blind
 * `Map<pluginId, surface>` so the shell can resolve without a generated binder
 * (Phase 4ao deleted the operator-ui binder; 4bq keyed by pluginId).
 */

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const OPERATOR_UI_COMPONENTS_SURFACE_KEY = "app-cloud.operatorUiComponentsSurface";

export type OperatorUiComponentsSurface = {
  readonly TimeInput: unknown;
  readonly DifficultyRangeSlider: unknown;
  readonly LocationPickerMap: unknown;
  readonly LocationPickerMapInner: unknown;
  readonly ensureLeafletDefaultIcon: () => void;
  readonly WizardDatetimePicker: unknown;
};

type GlobalRegistry = typeof globalThis & {
  [OPERATOR_UI_COMPONENTS_SURFACE_KEY]?: Map<string, OperatorUiComponentsSurface>;
};

function getCache(): Map<string, OperatorUiComponentsSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[OPERATOR_UI_COMPONENTS_SURFACE_KEY];
  // Phase 4bq: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[OPERATOR_UI_COMPONENTS_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekOperatorUiComponentsSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): OperatorUiComponentsSurface | null {
  if (pluginId.trim().length === 0) {
    return null;
  }
  return getCache().get(pluginId) ?? null;
}

export function requireOperatorUiComponentsSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): OperatorUiComponentsSurface {
  const current = peekOperatorUiComponentsSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Operator UI cold (call operatorUi.ensureReady / ensureOperatorUiComponentsPackageSurface first)"
    );
  }
  return current;
}

/**
 * Warm + publish operator UI surface under plugin id. Idempotent.
 * Invoked from `capabilities.operatorUi.ensureReady` and wizardHost ensureReady.
 */
export async function ensureOperatorUiComponentsPackageSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<OperatorUiComponentsSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekOperatorUiComponentsSurface(id);
  if (existing != null) {
    return existing;
  }

  // String-keyed so plugin/wizard tsc does not pull `src/ui` statically.
  const mod = await import("../ui/operator-ui-components-surface");
  const next = Object.freeze({
    TimeInput: mod.denaliOperatorUiComponentsSurface.TimeInput,
    DifficultyRangeSlider: mod.denaliOperatorUiComponentsSurface.DifficultyRangeSlider,
    LocationPickerMap: mod.denaliOperatorUiComponentsSurface.LocationPickerMap,
    LocationPickerMapInner: mod.denaliOperatorUiComponentsSurface.LocationPickerMapInner,
    ensureLeafletDefaultIcon: mod.denaliOperatorUiComponentsSurface.ensureLeafletDefaultIcon,
    WizardDatetimePicker: mod.denaliOperatorUiComponentsSurface.WizardDatetimePicker,
  }) as OperatorUiComponentsSurface;

  getCache().set(id, next);
  return next;
}
