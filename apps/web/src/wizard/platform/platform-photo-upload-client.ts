import { resolveWizardMediaBffPath } from "@/wizard/resolve-wizard-media-bff-path";

export const PLATFORM_PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const PLATFORM_PHOTO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PlatformWizardPhotoUploadResult = {
  readonly objectKey: string;
  readonly photoId: string;
  readonly contentType: string;
};

function parsePhotoApiErrorCode(payload: Record<string, unknown>, status: number): string {
  const nested = payload.error;
  if (isRecord(nested) && typeof nested.code === "string" && nested.code.length > 0) {
    return nested.code;
  }
  if (typeof payload.code === "string" && payload.code.length > 0) {
    return payload.code;
  }
  return `PHOTO_UPLOAD_HTTP_${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validatePlatformPhotoFile(file: File): string | null {
  if (
    !PLATFORM_PHOTO_ALLOWED_CONTENT_TYPES.includes(
      file.type as (typeof PLATFORM_PHOTO_ALLOWED_CONTENT_TYPES)[number]
    )
  ) {
    return "PHOTO_INVALID_TYPE";
  }
  if (file.size > PLATFORM_PHOTO_UPLOAD_MAX_BYTES) {
    return "PHOTO_FILE_TOO_LARGE";
  }
  return null;
}

export async function uploadPlatformWizardPhoto(input: {
  readonly sessionId: string;
  readonly photoId: string;
  readonly file: File;
  readonly mediaRouteKey?: string;
}): Promise<PlatformWizardPhotoUploadResult> {
  const validationError = validatePlatformPhotoFile(input.file);
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
    throw new Error(parsePhotoApiErrorCode(payload, response.status));
  }

  const objectKey =
    typeof payload.storageKey === "string"
      ? payload.storageKey
      : typeof payload.objectKey === "string"
        ? payload.objectKey
        : "";
  const photoId = typeof payload.photoId === "string" ? payload.photoId : input.photoId;
  const contentType =
    typeof payload.contentType === "string" ? payload.contentType : input.file.type;
  if (objectKey.length === 0) {
    throw new Error("PHOTO_MISSING_STORAGE_KEY");
  }

  return { objectKey, photoId, contentType };
}
