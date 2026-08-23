import type { CanonicalDocument, TourListProjectionFields } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

/**
 * CW3-07 compat — plugin `tourList.extractTourListProjection` (retained until census zero).
 * Parity proofs only; production list path uses manifest-bound dispatch.
 */
export async function extractTourListProjectionViaPlugin(
  workspaceType: string,
  canonical: CanonicalDocument,
): Promise<TourListProjectionFields> {
  const extract = (await resolveWorkspacePluginForType(workspaceType)).tourList
    ?.extractTourListProjection;
  if (extract === undefined) {
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
  return extract(canonical);
}
