import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";

const pluginById = new Map<string, WorkspacePlugin>();
const tourDetailById = new Map<string, OperatorTourDetailResponse>();
const tourDetailInflight = new Map<string, Promise<OperatorTourDetailResponse>>();

export function readCachedTourPlugin(pluginId: string): WorkspacePlugin | null {
  return pluginById.get(pluginId.trim()) ?? null;
}

export function writeCachedTourPlugin(pluginId: string, plugin: WorkspacePlugin): void {
  pluginById.set(pluginId.trim(), plugin);
}

export function readCachedTourDetail(tourId: string): OperatorTourDetailResponse | null {
  return tourDetailById.get(tourId.trim()) ?? null;
}

export function writeCachedTourDetail(
  tourId: string,
  detail: OperatorTourDetailResponse
): void {
  tourDetailById.set(tourId.trim(), detail);
}

export function invalidateCachedTourDetail(tourId: string): void {
  const id = tourId.trim();
  tourDetailById.delete(id);
  tourDetailInflight.delete(id);
}

/** Shared tour detail fetch — dedupes in-flight requests across edit ↔ workspace navigations. */
export async function fetchTourDetailCached(
  tourId: string,
  options?: { readonly force?: boolean }
): Promise<OperatorTourDetailResponse> {
  const id = tourId.trim();
  if (options?.force === true) {
    invalidateCachedTourDetail(id);
  }

  const cached = tourDetailById.get(id);
  if (cached !== undefined) {
    return cached;
  }

  let inflight = tourDetailInflight.get(id);
  if (inflight === undefined) {
    inflight = fetch(`/api/tours/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorTourDetailResponse;
      })
      .then((payload) => {
        tourDetailById.set(id, payload);
        return payload;
      })
      .finally(() => {
        tourDetailInflight.delete(id);
      });
    tourDetailInflight.set(id, inflight);
  }

  return inflight;
}

export function clearTourRouteCacheForTests(): void {
  pluginById.clear();
  tourDetailById.clear();
  tourDetailInflight.clear();
}
