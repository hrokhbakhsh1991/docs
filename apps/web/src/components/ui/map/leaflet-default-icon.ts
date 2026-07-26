import {
  ensureOperatorUiComponentsSurface,
  resolveOperatorUiComponentsSurface,
} from "@/wizard/operator-ui-components-registry";

/**
 * Gap Closure B.9 / Thin Shell Phase 4ao — leaflet icon helper from warm operator-ui surface.
 * Prefer calling after operatorUi.ensureReady / warmOperatorWizardShell.
 */
export async function ensureLeafletDefaultIcon(pluginId: string): Promise<void> {
  const surface =
    resolveOperatorUiComponentsSurface(pluginId) ??
    (await ensureOperatorUiComponentsSurface(pluginId));
  if (surface == null) {
    throw new Error(`No operator UI surface for plugin: ${pluginId}`);
  }
  surface.ensureLeafletDefaultIcon();
}
