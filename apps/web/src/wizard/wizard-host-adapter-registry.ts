import type { ComponentType, ReactNode } from "react";

/**
 * Thin Shell Phase 2c / 4br / 4bt — product-blind shell reader for host-adapter surface.
 * Workspace packages publish on a `Map<pluginId, surface>` from package `ensureReady`.
 * Phase 4bt: every sync helper requires `pluginId` (no ambient active-id).
 */

export const WIZARD_HOST_ADAPTER_SURFACE_KEY = "app-cloud.wizardHostAdapterSurface";

/** Neutral rules-not-ready wire code (Phase 2d — was product-prefixed). */
export const WIZARD_RULES_NOT_READY_CODE = "WIZARD_RULES_NOT_READY";

export type ExposureCatalogFieldForLocalization = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
};

export type WizardCatalogPrefetchProviderProps = {
  readonly children: ReactNode;
  readonly initialLocationsResponse?: unknown | null;
};

export type WizardCatalogPrefetch = {
  readonly initialLocationsResponse: unknown | null;
};

export type WizardEditTourRemoteDraftIdentity = {
  readonly namespace: string;
  readonly draftKey: string;
};

export type WizardFlatEditTourHttpFailure = {
  readonly ok: false;
  readonly kind: "not-found" | "error";
  readonly code: string;
};

/** Loose surface shape — workspace packages own concrete types after ensureReady. */
type WizardHostAdapterSurface = {
  readonly buildWizardFreshStartMeta: (...args: any[]) => any;
  readonly buildWizardStepZeroMeta: (...args: any[]) => any;
  readonly buildCreateTourDiscardRemoteDraftInput: (...args: any[]) => any;
  readonly createTourRemoteDraftIdentity: (...args: any[]) => any;
  readonly prepareCreateTourFreshStartEnvelope: (...args: any[]) => any;
  readonly editTourRemoteDraftIdentity: (...args: any[]) => WizardEditTourRemoteDraftIdentity;
  readonly buildFlatEditTourLoadSuccess: (...args: any[]) => any;
  readonly flatEditHydratorUnavailableResult: (...args: any[]) => any;
  readonly finalizeFlatEditTourLoad: (...args: any[]) => any;
  readonly mapFlatEditTourHttpStatus: (
    status: number
  ) => WizardFlatEditTourHttpFailure | null;
  readonly CatalogPrefetchProvider: ComponentType<WizardCatalogPrefetchProviderProps>;
  readonly useCatalogPrefetch: () => WizardCatalogPrefetch;
  readonly readActiveDestinationIds: (...args: any[]) => any;
  readonly readActiveEquipmentIds: (...args: any[]) => any;
  readonly readActiveThemeIds: (...args: any[]) => any;
  readonly localizeExposureCatalogFields: (...args: any[]) => any;
  readonly buildFlatEditMetaLine: (...args: any[]) => any;
  readonly localizeWizardValidationIssueMessage: (...args: any[]) => any;
  readonly resolveActiveCatalogIdsFromResourcePayloads: (...args: any[]) => any;
};

type GlobalRegistry = typeof globalThis & {
  [WIZARD_HOST_ADAPTER_SURFACE_KEY]?: Map<string, WizardHostAdapterSurface>;
};

function getCache(): Map<string, WizardHostAdapterSurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[WIZARD_HOST_ADAPTER_SURFACE_KEY];
  // Phase 4br: discard legacy singleton Surface if HMR left it on globalThis.
  if (cache == null || !(cache instanceof Map)) {
    cache = new Map();
    g[WIZARD_HOST_ADAPTER_SURFACE_KEY] = cache;
  }
  return cache;
}

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
  const surface = peekWizardHostAdapterSurface(pluginId);
  if (surface == null) {
    throw new Error("Wizard host adapters cold (call wizardHost.ensureReady first)");
  }
  return surface;
}

export function resolveWizardCatalogPrefetchProvider(
  pluginId: string
): ComponentType<WizardCatalogPrefetchProviderProps> | null {
  return peekWizardHostAdapterSurface(pluginId)?.CatalogPrefetchProvider ?? null;
}

export function buildWizardFreshStartMeta(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).buildWizardFreshStartMeta(...args);
}

export function buildWizardStepZeroMeta(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).buildWizardStepZeroMeta(...args);
}

export function buildCreateTourDiscardRemoteDraftInput(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).buildCreateTourDiscardRemoteDraftInput(
    ...args
  );
}

export function createTourRemoteDraftIdentity(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).createTourRemoteDraftIdentity(...args);
}

export function prepareCreateTourFreshStartEnvelope(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).prepareCreateTourFreshStartEnvelope(...args);
}

export function editTourRemoteDraftIdentity(
  pluginId: string,
  ...args: any[]
): WizardEditTourRemoteDraftIdentity {
  return requireWizardHostAdapterSurface(pluginId).editTourRemoteDraftIdentity(...args);
}

export function buildFlatEditMetaLine(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).buildFlatEditMetaLine(...args);
}

export function finalizeFlatEditTourLoad(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).finalizeFlatEditTourLoad(...args);
}

export function mapFlatEditTourHttpStatus(
  pluginId: string,
  status: number
): WizardFlatEditTourHttpFailure | null {
  return requireWizardHostAdapterSurface(pluginId).mapFlatEditTourHttpStatus(status);
}

export function localizeWizardValidationIssueMessage(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).localizeWizardValidationIssueMessage(
    ...args
  );
}

export function readActiveThemeIds(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).readActiveThemeIds(...args);
}

export function localizeExposureCatalogFields<T extends ExposureCatalogFieldForLocalization>(
  pluginId: string,
  fields: readonly T[],
  translateWizard: (...args: any[]) => any
): readonly T[] {
  return requireWizardHostAdapterSurface(pluginId).localizeExposureCatalogFields(
    fields,
    translateWizard
  ) as readonly T[];
}

export function readActiveDestinationIds(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).readActiveDestinationIds(...args);
}

export function readActiveEquipmentIds(pluginId: string, ...args: any[]): any {
  return requireWizardHostAdapterSurface(pluginId).readActiveEquipmentIds(...args);
}

export function resolveActiveCatalogIdsFromResourcePayloads(
  pluginId: string,
  ...args: any[]
): any {
  return requireWizardHostAdapterSurface(pluginId).resolveActiveCatalogIdsFromResourcePayloads(
    ...args
  );
}
