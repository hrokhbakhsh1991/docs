/**
 * Thin Shell Phase 4aq — product-blind shell reader for wizard label resolvers.
 * Workspace packages publish on `app-cloud.wizardLabelResolverCache` from
 * `labels.ensureReady`. Generated label binder deleted — registry only.
 */

import {
  resolveLabelsCapability,
  type WorkspacePlugin,
} from "@app-cloud/workspace-sdk";

import type { WizardLabelResolver } from "@/wizard/wizard-surface-types";
import { loadWizardWorkspacePlugin } from "@/wizard/resolve-wizard-workspace-plugin";

export const WIZARD_LABEL_RESOLVER_CACHE_KEY = "app-cloud.wizardLabelResolverCache";

type GlobalRegistry = typeof globalThis & {
  [WIZARD_LABEL_RESOLVER_CACHE_KEY]?: Map<string, WizardLabelResolver>;
};

function getCache(): Map<string, WizardLabelResolver> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_LABEL_RESOLVER_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WIZARD_LABEL_RESOLVER_CACHE_KEY] = cache;
  }
  return cache;
}

export function peekWizardLabelResolver(
  surfaceId: string | undefined
): WizardLabelResolver | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return getCache().get(surfaceId) ?? null;
}

/** Sync read of published cache — call ensureGeneratedLabelResolver first. */
export function resolveGeneratedLabelResolver(
  surfaceId: string | undefined
): WizardLabelResolver | null {
  return peekWizardLabelResolver(surfaceId);
}

/**
 * Warm via capability when present; return published resolver (or null when omitted).
 * `surfaceId` is the plugin / field-label surface id (same as plugin id for trunk products).
 */
export async function ensureGeneratedLabelResolver(
  surfaceId: string | undefined
): Promise<WizardLabelResolver | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  const existing = peekWizardLabelResolver(surfaceId);
  if (existing != null) {
    return existing;
  }
  try {
    const plugin = await loadWizardWorkspacePlugin(surfaceId);
    await resolveLabelsCapability(plugin)?.ensureReady?.();
  } catch {
    return null;
  }
  return peekWizardLabelResolver(surfaceId);
}

/** Warm using an in-hand plugin (preferred when already loaded). */
export async function ensureGeneratedLabelResolverForPlugin(
  plugin: WorkspacePlugin,
  surfaceId?: string
): Promise<WizardLabelResolver | null> {
  const id = surfaceId?.trim() || plugin.id;
  const existing = peekWizardLabelResolver(id);
  if (existing != null) {
    return existing;
  }
  await resolveLabelsCapability(plugin)?.ensureReady?.();
  return peekWizardLabelResolver(id);
}
