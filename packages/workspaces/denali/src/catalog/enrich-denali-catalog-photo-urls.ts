import {
  readDenaliCanonicalPhotoRows,
  readDenaliFirstPhotoHttpsUrl,
  readDenaliFirstPhotoStorageKey,
} from "../list/read-denali-first-photo";
import {
  getDenaliTourPhotoSignedReadUrl,
  readMinioPhotoConfigFromEnv,
} from "../photos/minio-photo-storage";
import { isDenaliOperatorTourPhotoReadKeyAllowed } from "../photos/tour-photo-object-key";
import { isDenaliHttpsImageUrl } from "../schemas/denaliFileAssetSchema";

/** Public catalog cards — long enough for a browsing session without re-fetching list/detail. */
const PUBLIC_CATALOG_PHOTO_SIGNED_URL_TTL_SECONDS = 3600;

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function signDenaliCatalogPhotoStorageKey(
  tenantId: string,
  storageKey: string
): Promise<string | null> {
  if (!isDenaliOperatorTourPhotoReadKeyAllowed(tenantId, storageKey)) {
    return null;
  }
  const config = readMinioPhotoConfigFromEnv();
  if (config === null) {
    return null;
  }
  try {
    return await getDenaliTourPhotoSignedReadUrl({
      config,
      tenantId,
      key: storageKey,
      expiresInSeconds: PUBLIC_CATALOG_PHOTO_SIGNED_URL_TTL_SECONDS,
    });
  } catch {
    return null;
  }
}

/** Resolve id → URL for itinerary segment `photoIds` (https rows + signed MinIO keys). */
export async function buildDenaliCatalogPhotoUrlById(
  canonicalData: Record<string, unknown>,
  tenantId: string
): Promise<ReadonlyMap<string, string>> {
  const byId = new Map<string, string>();
  for (const row of readDenaliCanonicalPhotoRows(canonicalData)) {
    const id = readString(row.id);
    if (id == null) {
      continue;
    }
    const httpsUrl = readString(row.url);
    if (httpsUrl != null && isDenaliHttpsImageUrl(httpsUrl)) {
      byId.set(id, httpsUrl);
      continue;
    }
    const storageKey = readString(row.storageKey);
    if (storageKey == null) {
      continue;
    }
    const signedUrl = await signDenaliCatalogPhotoStorageKey(tenantId, storageKey);
    if (signedUrl != null) {
      byId.set(id, signedUrl);
    }
  }
  return byId;
}

/** Cover URL when canonical stores MinIO `storageKey` instead of https `url`. */
export async function resolveDenaliCatalogCoverImageUrl(
  canonicalData: Record<string, unknown>,
  tenantId: string
): Promise<string | null> {
  const httpsUrl = readDenaliFirstPhotoHttpsUrl(canonicalData.photos);
  if (httpsUrl != null) {
    return httpsUrl;
  }
  const storageKey = readDenaliFirstPhotoStorageKey(canonicalData.photos);
  if (storageKey == null) {
    return null;
  }
  return signDenaliCatalogPhotoStorageKey(tenantId, storageKey);
}

export type DenaliCatalogPhotoEnrichment = {
  readonly coverImageUrl: string | null;
  readonly photoUrlById: ReadonlyMap<string, string>;
};

export async function resolveDenaliCatalogPhotoEnrichment(
  canonicalData: Record<string, unknown>,
  tenantId: string
): Promise<DenaliCatalogPhotoEnrichment> {
  const [coverImageUrl, photoUrlById] = await Promise.all([
    resolveDenaliCatalogCoverImageUrl(canonicalData, tenantId),
    buildDenaliCatalogPhotoUrlById(canonicalData, tenantId),
  ]);
  return { coverImageUrl, photoUrlById };
}
