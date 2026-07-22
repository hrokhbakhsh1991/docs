import {
  ensureOperatorUiComponentsSurface,
  resolveOperatorUiComponentsSurface,
} from "@/bootstrap/workspace-operator-ui-components-bindings.generated";

/**
 * Gap Closure B.9 — leaflet icon helper from warm operator-ui surface.
 * Prefer calling after ensureOperatorUiComponentsSurface(pluginId).
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
