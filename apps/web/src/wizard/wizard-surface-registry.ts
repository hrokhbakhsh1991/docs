/**
 * Thin Shell Phase 4as — product-blind shell reader for wizard composite/review surfaces.
 * Shell-local `platform` surfaces stay eager; product surfaces publish via
 * `capabilities.wizardSurfaces.ensureReady` onto product-blind caches.
 */

import {
  resolveWizardSurfacesCapability,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { createPlatformCompositeSurface } from "@/wizard/platform/platform-composite-surface";
import { createPlatformReviewSurface } from "@/wizard/platform/platform-review-surface";
import type { WizardCompositeSurface, WizardReviewSurface } from "@/wizard/wizard-surface-types";
import { loadWizardWorkspacePlugin } from "@/wizard/resolve-wizard-workspace-plugin";

export const WIZARD_COMPOSITE_SURFACE_CACHE_KEY = "app-cloud.wizardCompositeSurfaceCache";
export const WIZARD_REVIEW_SURFACE_CACHE_KEY = "app-cloud.wizardReviewSurfaceCache";

type GlobalRegistry = typeof globalThis & {
  [WIZARD_COMPOSITE_SURFACE_CACHE_KEY]?: Map<string, WizardCompositeSurface>;
  [WIZARD_REVIEW_SURFACE_CACHE_KEY]?: Map<string, WizardReviewSurface>;
};

function getCompositeCache(): Map<string, WizardCompositeSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_COMPOSITE_SURFACE_CACHE_KEY];
  if (cache == null) {
    cache = new Map<string, WizardCompositeSurface>([
      ["platform", createPlatformCompositeSurface()],
    ]);
    g[WIZARD_COMPOSITE_SURFACE_CACHE_KEY] = cache;
  } else if (!cache.has("platform")) {
    cache.set("platform", createPlatformCompositeSurface());
  }
  return cache;
}

function getReviewCache(): Map<string, WizardReviewSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_REVIEW_SURFACE_CACHE_KEY];
  if (cache == null) {
    cache = new Map<string, WizardReviewSurface>([
      ["platform", createPlatformReviewSurface()],
    ]);
    g[WIZARD_REVIEW_SURFACE_CACHE_KEY] = cache;
  } else if (!cache.has("platform")) {
    cache.set("platform", createPlatformReviewSurface());
  }
  return cache;
}

export function resolveGeneratedCompositeSurface(
  surfaceId: string | undefined
): WizardCompositeSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return getCompositeCache().get(surfaceId) ?? null;
}

export function resolveGeneratedReviewSurface(
  surfaceId: string | undefined
): WizardReviewSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return getReviewCache().get(surfaceId) ?? null;
}

export async function ensureGeneratedCompositeSurface(
  surfaceId: string | undefined
): Promise<WizardCompositeSurface | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  const existing = resolveGeneratedCompositeSurface(surfaceId);
  if (existing != null) {
    return existing;
  }
  if (surfaceId === "platform") {
    return resolveGeneratedCompositeSurface("platform");
  }
  try {
    const plugin = await loadWizardWorkspacePlugin(surfaceId);
    await resolveWizardSurfacesCapability(plugin)?.ensureReady?.();
  } catch {
    return null;
  }
  return resolveGeneratedCompositeSurface(surfaceId);
}

export async function ensureGeneratedReviewSurface(
  surfaceId: string | undefined
): Promise<WizardReviewSurface | null> {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  const existing = resolveGeneratedReviewSurface(surfaceId);
  if (existing != null) {
    return existing;
  }
  if (surfaceId === "platform") {
    return resolveGeneratedReviewSurface("platform");
  }
  try {
    const plugin = await loadWizardWorkspacePlugin(surfaceId);
    await resolveWizardSurfacesCapability(plugin)?.ensureReady?.();
  } catch {
    return null;
  }
  return resolveGeneratedReviewSurface(surfaceId);
}

export async function ensureWizardSurfacesForPlugin(
  plugin: WorkspacePlugin
): Promise<void> {
  await resolveWizardSurfacesCapability(plugin)?.ensureReady?.();
}
