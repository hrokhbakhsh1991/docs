import type { ComponentType, ReactNode } from "react";

import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";

/**
 * Thin Shell Phase 2b / 4br / 4bt — package-owned host-adapter surface.
 * Wizard tsc stays free of `src/ui` via string-keyed dynamic imports.
 * After warm, surface is published on a product-blind `Map<pluginId, surface>`.
 * Phase 4bt: no ambient active-pluginId — callers must pass pluginId.
 */

/** Product-blind registry key (shell + workspace agree; no Denali token). */
export const WIZARD_HOST_ADAPTER_SURFACE_KEY = "app-cloud.wizardHostAdapterSurface";

export type WizardCatalogPrefetchProviderProps = {
  readonly children: ReactNode;
  readonly initialLocationsResponse?: unknown | null;
};

export type WizardHostAdapterSurface = {
  readonly buildWizardFreshStartMeta: (...args: unknown[]) => unknown;
  readonly buildWizardStepZeroMeta: (...args: unknown[]) => unknown;
  readonly buildCreateTourDiscardRemoteDraftInput: (...args: unknown[]) => unknown;
  readonly createTourRemoteDraftIdentity: (...args: unknown[]) => unknown;
  readonly prepareCreateTourFreshStartEnvelope: (...args: unknown[]) => unknown;
  readonly editTourRemoteDraftIdentity: (...args: unknown[]) => unknown;
  readonly buildFlatEditTourLoadSuccess: (...args: unknown[]) => unknown;
  readonly flatEditHydratorUnavailableResult: (...args: unknown[]) => unknown;
  readonly finalizeFlatEditTourLoad: (...args: unknown[]) => unknown;
  readonly mapFlatEditTourHttpStatus: (status: number) => unknown;
  readonly CatalogPrefetchProvider: ComponentType<WizardCatalogPrefetchProviderProps>;
  readonly useCatalogPrefetch: () => { readonly initialLocationsResponse: unknown | null };
  readonly readActiveDestinationIds: (...args: unknown[]) => unknown;
  readonly readActiveEquipmentIds: (...args: unknown[]) => unknown;
  readonly readActiveThemeIds: (...args: unknown[]) => unknown;
  readonly localizeExposureCatalogFields: (...args: unknown[]) => unknown;
  readonly buildFlatEditMetaLine: (...args: unknown[]) => unknown;
  readonly localizeWizardValidationIssueMessage: (...args: unknown[]) => unknown;
  readonly resolveActiveCatalogIdsFromResourcePayloads: (...args: unknown[]) => unknown;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_HOST_ADAPTER_SURFACE_KEY]?: Map<string, WizardHostAdapterSurface>;
};

function getCache(): Map<string, WizardHostAdapterSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_HOST_ADAPTER_SURFACE_KEY];
  // Phase 4br: discard legacy singleton Surface if present on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_HOST_ADAPTER_SURFACE_KEY] = cache;
  }
  return cache;
}

/** Read package or global registry (shell may read global without importing this module). */
export function peekWizardHostAdapterSurface(
  pluginId: string
): WizardHostAdapterSurface | null {
  const id = pluginId.trim();
  if (id.length === 0) {
    return null;
  }
  return getCache().get(id) ?? null;
}

export function requireWizardHostAdapterSurface(
  pluginId: string
): WizardHostAdapterSurface {
  const current = peekWizardHostAdapterSurface(pluginId);
  if (current == null) {
    throw new Error(
      "Wizard host adapters cold (call wizardHost.ensureReady / ensureWizardHostAdapterSurface first)"
    );
  }
  return current;
}

export function resolveWizardCatalogPrefetchProvider(
  pluginId: string
): ComponentType<WizardCatalogPrefetchProviderProps> | null {
  return peekWizardHostAdapterSurface(pluginId)?.CatalogPrefetchProvider ?? null;
}

/**
 * Warm + publish host-adapter surface under plugin id. Idempotent.
 * Invoked from `denaliWizardHostHooks.ensureReady`.
 */
export async function ensureWizardHostAdapterSurface(
  pluginId: string = DENALI_WORKSPACE_PLUGIN_ID
): Promise<WizardHostAdapterSurface> {
  const id = pluginId.trim().length > 0 ? pluginId : DENALI_WORKSPACE_PLUGIN_ID;
  const existing = peekWizardHostAdapterSurface(id);
  if (existing != null) {
    return existing;
  }

  const [
    draftMod,
    loadResultMod,
    httpStatusMod,
    prefetchMod,
    sanitizeMod,
    exposureMod,
    metaMod,
    localizeMod,
    catalogMod,
  ] = await Promise.all([
    import("../draft"),
    import("../ui/chrome/build-denali-flat-edit-tour-load-result"),
    import("../ui/chrome/map-denali-flat-edit-tour-http-status"),
    import("../ui/hooks/denali-wizard-catalog-prefetch-context"),
    import("./denali-wizard-catalog-sanitize"),
    import("../ui/adapters/localize-exposure-catalog-fields"),
    import("../ui/chrome/build-denali-flat-edit-meta-line"),
    import("./localize-denali-validation-message"),
    import("../ui/adapters/read-active-catalog-ids-from-payload"),
  ]);

  const next = Object.freeze({
    buildWizardFreshStartMeta: draftMod.buildDenaliWizardFreshStartMeta,
    buildWizardStepZeroMeta: draftMod.buildDenaliWizardStepZeroMeta,
    buildCreateTourDiscardRemoteDraftInput: draftMod.buildDenaliCreateTourDiscardRemoteDraftInput,
    createTourRemoteDraftIdentity: draftMod.denaliCreateTourRemoteDraftIdentity,
    prepareCreateTourFreshStartEnvelope: draftMod.prepareDenaliCreateTourFreshStartEnvelope,
    editTourRemoteDraftIdentity: draftMod.denaliEditTourRemoteDraftIdentity,
    buildFlatEditTourLoadSuccess: loadResultMod.buildDenaliFlatEditTourLoadSuccess,
    flatEditHydratorUnavailableResult: loadResultMod.denaliFlatEditHydratorUnavailableResult,
    finalizeFlatEditTourLoad: loadResultMod.finalizeDenaliFlatEditTourLoad,
    mapFlatEditTourHttpStatus: httpStatusMod.mapDenaliFlatEditTourHttpStatus,
    CatalogPrefetchProvider: prefetchMod.DenaliWizardCatalogPrefetchProvider,
    useCatalogPrefetch: prefetchMod.useDenaliWizardCatalogPrefetch,
    readActiveDestinationIds: sanitizeMod.readActiveDestinationIds,
    readActiveEquipmentIds: sanitizeMod.readActiveEquipmentIds,
    readActiveThemeIds: sanitizeMod.readActiveThemeIds,
    localizeExposureCatalogFields: exposureMod.localizeExposureCatalogFields,
    buildFlatEditMetaLine: metaMod.buildDenaliFlatEditMetaLine,
    localizeWizardValidationIssueMessage: localizeMod.localizeDenaliValidationIssueMessage,
    resolveActiveCatalogIdsFromResourcePayloads:
      catalogMod.resolveActiveCatalogIdsFromResourcePayloads,
  } as WizardHostAdapterSurface);

  getCache().set(id, next);
  return next;
}
