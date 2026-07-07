import { fetchWithTransientRetry } from "@app-tour/draft-engine";
import { parseDenaliPhotoApiErrorCode } from "./photo-upload-errors";
import { resolveWizardMediaBffPath } from "./wizard-media-bff-path";

export const DENALI_PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const DENALI_PHOTO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type DenaliWizardPhotoUploadResult = {
  readonly storageKey: string;
  readonly photoId: string;
  readonly contentType: string;
};

export type DenaliWizardPhotoPreviewResolveResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly code: string };

export function validateDenaliPhotoFile(file: File): string | null {
  if (
    !DENALI_PHOTO_ALLOWED_CONTENT_TYPES.includes(
      file.type as (typeof DENALI_PHOTO_ALLOWED_CONTENT_TYPES)[number]
    )
  ) {
    return "PHOTO_INVALID_TYPE";
  }
  if (file.size > DENALI_PHOTO_UPLOAD_MAX_BYTES) {
    return "PHOTO_FILE_TOO_LARGE";
  }
  return null;
}

export async function uploadDenaliWizardPhoto(input: {
  readonly sessionId: string;
  readonly photoId: string;
  readonly file: File;
  readonly mediaRouteKey?: string;
}): Promise<DenaliWizardPhotoUploadResult> {
  const validationError = validateDenaliPhotoFile(input.file);
  if (validationError !== null) {
    throw new Error(validationError);
  }

  const mediaRouteKey = input.mediaRouteKey ?? "wizard-photos";
  const bffPath = resolveWizardMediaBffPath(mediaRouteKey);
  const body = new Uint8Array(await input.file.arrayBuffer());
  const response = await fetch(bffPath, {
    method: "POST",
    headers: {
      "Content-Type": input.file.type,
      "X-Wizard-Session-Id": input.sessionId,
      "X-Photo-Id": input.photoId,
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(parseDenaliPhotoApiErrorCode(payload, response.status));
  }

  const storageKey = typeof payload.storageKey === "string" ? payload.storageKey : "";
  const photoId = typeof payload.photoId === "string" ? payload.photoId : input.photoId;
  const contentType =
    typeof payload.contentType === "string" ? payload.contentType : input.file.type;
  if (storageKey.length === 0) {
    throw new Error("PHOTO_MISSING_STORAGE_KEY");
  }

  return { storageKey, photoId, contentType };
}

export async function resolveDenaliWizardPhotoPreviewUrl(
  storageKey: string,
  mediaRouteKey = "wizard-photos"
): Promise<DenaliWizardPhotoPreviewResolveResult> {
  const bffPath = resolveWizardMediaBffPath(mediaRouteKey);
  const params = new URLSearchParams({ storageKey });
  const response = await fetchWithTransientRetry(`${bffPath}/url?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return { ok: false, code: parseDenaliPhotoApiErrorCode(payload, response.status) };
  }
  const url = typeof payload.url === "string" && payload.url.length > 0 ? payload.url : "";
  if (url.length === 0) {
    return { ok: false, code: "PHOTO_PREVIEW_URL_MISSING" };
  }
  return { ok: true, url };
}
