/**
 * Thin Shell Phase 4aw — wizard template editor via capabilities.templateEditor.
 * Product-blind warm cache supports sync resolve after ensure; binder deleted.
 */

import {
  resolveTemplateEditorCapability,
  type WorkspacePlugin,
  type WorkspaceTemplateEditorCapability,
} from "@app-cloud/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import type { WizardTemplateEditorSurface } from "@/wizard/wizard-template-editor-types";

export const WIZARD_TEMPLATE_EDITOR_CACHE_KEY = "app-cloud.wizardTemplateEditorCache";

type GlobalRegistry = typeof globalThis & {
  [WIZARD_TEMPLATE_EDITOR_CACHE_KEY]?: Map<string, WizardTemplateEditorSurface>;
};

function getCache(): Map<string, WizardTemplateEditorSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_TEMPLATE_EDITOR_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WIZARD_TEMPLATE_EDITOR_CACHE_KEY] = cache;
  }
  return cache;
}

function surfaceFromPlugin(plugin: WorkspacePlugin): WizardTemplateEditorSurface | null {
  const cap: WorkspaceTemplateEditorCapability | undefined =
    resolveTemplateEditorCapability(plugin);
  if (cap == null) {
    return null;
  }
  return cap as WizardTemplateEditorSurface;
}

/** Warm product surface via capability (no generated binder). */
export async function ensureWizardTemplateEditor(
  pluginId: string
): Promise<WizardTemplateEditorSurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = getCache().get(pluginId);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    const surface = surfaceFromPlugin(plugin);
    if (surface == null) {
      return null;
    }
    getCache().set(pluginId, surface);
    return surface;
  } catch {
    return null;
  }
}

/** Sync read of warm cache — call ensureWizardTemplateEditor first. */
export function resolveWizardTemplateEditor(
  pluginId: string
): WizardTemplateEditorSurface | null {
  return getCache().get(pluginId) ?? null;
}
