import type { CanonicalDocument, TourListProjectionFields } from "@app-tour/workspace-sdk";

import { WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS } from "./workspace-tour-list-projection-bindings.generated";

type TourListProjectionBinding = (typeof WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS)[number];

function buildBindingMap(): Readonly<Record<string, TourListProjectionBinding>> {
  const map: Record<string, TourListProjectionBinding> = {};
  for (const binding of WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS) {
    map[binding.workspaceType as string] = binding;
  }
  return Object.freeze(map);
}

const bindingsByWorkspaceType = buildBindingMap();

function defaultExtractTourListProjection(_canonical: CanonicalDocument): TourListProjectionFields {
  return Object.freeze({
    title: "Untitled tour",
    shortDescription: null,
    listStatus: "draft",
    uiStatus: "draft",
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: null,
    acceptedCount: 0,
    category: null,
    coverImageUrl: null,
    coverImageStorageKey: null,
    departureAt: null,
  });
}

/**
 * Manifest-bound dispatch: extract operator tour list projection fields from canonical.
 * Fail-soft to starter draft projection when workspace binding is missing.
 */
export function extractTourListProjectionForWorkspace(
  workspaceType: string | undefined,
  canonical: CanonicalDocument,
): TourListProjectionFields {
  if (workspaceType === undefined) {
    return defaultExtractTourListProjection(canonical);
  }
  const binding = bindingsByWorkspaceType[workspaceType];
  if (binding === undefined) {
    return defaultExtractTourListProjection(canonical);
  }
  return binding.extractTourListProjection(canonical);
}

export function resolveTourListProjectionExtractorForWorkspace(
  workspaceType: string | undefined,
): TourListProjectionBinding["extractTourListProjection"] {
  if (workspaceType === undefined) {
    return defaultExtractTourListProjection;
  }
  const binding = bindingsByWorkspaceType[workspaceType];
  if (binding === undefined) {
    return defaultExtractTourListProjection;
  }
  return binding.extractTourListProjection;
}
