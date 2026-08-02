/**
 * Thin Shell Phase 4bg — wizard create / extended chrome via capabilities.wizardCreate.
 * Product-blind warm cache supports sync helpers after ensure/seed.
 */

import {
  resolveWizardCreateCapability,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export const WIZARD_CREATE_CACHE_KEY = "app-cloud.wizardCreateCache";

export type WizardCreateCacheEntry = {
  readonly extendedChrome: boolean;
  readonly customBrandFallbackMark?: string;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_CREATE_CACHE_KEY]?: Map<string, WizardCreateCacheEntry>;
};

function getCache(): Map<string, WizardCreateCacheEntry> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_CREATE_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[WIZARD_CREATE_CACHE_KEY] = cache;
  }
  return cache;
}

function entryFromPlugin(plugin: WorkspacePlugin): WizardCreateCacheEntry {
  const cap = resolveWizardCreateCapability(plugin);
  if (cap == null || cap.extendedChrome !== true) {
    return { extendedChrome: false };
  }
  const mark = cap.customBrandFallbackMark?.trim();
  return mark != null && mark.length > 0
    ? { extendedChrome: true, customBrandFallbackMark: mark }
    : { extendedChrome: true };
}

/** Seed warm cache from server-known truth (client shells — avoids hydration mismatch). */
export function seedWizardCreate(pluginId: string, entry: WizardCreateCacheEntry): void {
  const id = pluginId.trim();
  if (id.length === 0) {
    return;
  }
  getCache().set(id, entry);
}

/** Warm wizard-create flags via capability (no generated binder). */
export async function ensureWizardCreate(pluginId: string): Promise<WizardCreateCacheEntry> {
  const id = pluginId.trim();
  if (id.length === 0) {
    return { extendedChrome: false };
  }
  const cached = getCache().get(id);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(id);
    const entry = entryFromPlugin(plugin);
    getCache().set(id, entry);
    return entry;
  } catch {
    const cold = { extendedChrome: false } as const;
    getCache().set(id, cold);
    return cold;
  }
}

/**
 * Sync read of warm cache — call ensureWizardCreate (server) or seedWizardCreate (client) first.
 * Cold / unknown pluginId ⇒ false (fail-closed).
 */
export function isWizardExtendedCreatePlugin(pluginId: string): boolean {
  return getCache().get(pluginId)?.extendedChrome === true;
}

/** Manifest-declared brand fallback kind for pluginId, if warmed. */
export function resolveWizardCustomBrandFallbackMark(
  pluginId: string
): string | undefined {
  return getCache().get(pluginId)?.customBrandFallbackMark;
}
