import type { CanonicalDocument, TourListProjection } from "@app-tour/workspace-sdk";

import { resolveWizardMediaBinding } from "./workspace-wizard-media-dispatch";

/** Operator list cards — long enough for a browsing session without re-fetching list. */
const OPERATOR_LIST_COVER_SIGNED_URL_TTL_SECONDS = 3600;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export async function enrichTourListProjectionCoverImageUrl(
  projection: TourListProjection,
  canonical: CanonicalDocument,
  tenantId: string,
  workspaceType: string
): Promise<TourListProjection> {
  if (projection.coverImageUrl !== null && projection.coverImageUrl.trim().length > 0) {
    return Object.freeze({
      ...projection,
      coverImageStorageKey: null,
    });
  }

  const storageKey = projection.coverImageStorageKey?.trim() ?? "";
  if (storageKey.length === 0) {
    const data = canonical.data;
    if (!isRecord(data)) {
      return projection;
    }
    return projection;
  }

  const media = resolveWizardMediaBinding(workspaceType);
  if (media === undefined) {
    return projection;
  }

  const config = media.readPhotoConfigFromEnv();
  if (config === null) {
    return projection;
  }

  try {
    const signedUrl = await media.getSignedReadUrl({
      config,
      tenantId,
      key: storageKey,
      expiresInSeconds: OPERATOR_LIST_COVER_SIGNED_URL_TTL_SECONDS,
    });
    return Object.freeze({
      ...projection,
      coverImageUrl: signedUrl,
      coverImageStorageKey: null,
    });
  } catch {
    return projection;
  }
}

export async function enrichTourListProjectionsCoverImageUrls(
  items: readonly TourListProjection[],
  recordsById: ReadonlyMap<string, { readonly canonical: CanonicalDocument }>,
  tenantId: string,
  workspaceType: string
): Promise<readonly TourListProjection[]> {
  return Promise.all(
    items.map(async (item) => {
      const record = recordsById.get(item.id);
      if (record === undefined) {
        return item;
      }
      return enrichTourListProjectionCoverImageUrl(
        item,
        record.canonical,
        tenantId,
        workspaceType
      );
    })
  );
}
