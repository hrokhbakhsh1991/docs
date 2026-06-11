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

export type DenaliWizardPhotoUrlResult = {
  readonly url: string;
  readonly storageKey: string;
};

function parseUploadError(payload: unknown, status: number): string {
  if (payload !== null && typeof payload === "object") {
    const code =
      "code" in payload && typeof (payload as { code?: unknown }).code === "string"
        ? (payload as { code: string }).code
        : "error" in payload && typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : null;
    if (code !== null) {
      if (code === "MINIO_NOT_CONFIGURED") {
        return "PHOTO_STORAGE_NOT_CONFIGURED";
      }
      return code;
    }
  }
  return `PHOTO_UPLOAD_HTTP_${status}`;
}

export function validateDenaliPhotoFile(file: File): string | null {
  if (!DENALI_PHOTO_ALLOWED_CONTENT_TYPES.includes(file.type as (typeof DENALI_PHOTO_ALLOWED_CONTENT_TYPES)[number])) {
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
}): Promise<DenaliWizardPhotoUploadResult> {
  const validationError = validateDenaliPhotoFile(input.file);
  if (validationError !== null) {
    throw new Error(validationError);
  }

  const body = new Uint8Array(await input.file.arrayBuffer());
  const response = await fetch("/api/tours/wizard-photos", {
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
    throw new Error(parseUploadError(payload, response.status));
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
  storageKey: string
): Promise<string | null> {
  const params = new URLSearchParams({ storageKey });
  const response = await fetch(`/api/tours/wizard-photos/url?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return typeof payload.url === "string" && payload.url.length > 0 ? payload.url : null;
}
