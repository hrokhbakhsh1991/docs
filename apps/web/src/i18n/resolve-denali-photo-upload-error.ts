import { resolveCodedErrorMessage } from "./resolve-coded-error-message";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const PHOTO_UPLOAD_HTTP = /^PHOTO_UPLOAD_HTTP_(\d+)$/;

/** BFF nests some auth/transport errors; API returns flat `{ code }`. */
const PHOTO_ERROR_CODE_ALIASES: Readonly<Record<string, string>> = {
  MINIO_NOT_CONFIGURED: "PHOTO_STORAGE_NOT_CONFIGURED",
  AUTH_UNAUTHENTICATED: "PHOTO_AUTH_REQUIRED",
  BACKEND_UNREACHABLE: "PHOTO_BACKEND_UNREACHABLE",
  INVALID_UPLOAD_HEADERS: "PHOTO_INVALID_UPLOAD_HEADERS",
};

export function extractDenaliPhotoApiErrorCode(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return normalizeDenaliPhotoErrorCode(record.code.trim());
  }
  const nestedError = record.error;
  if (nestedError !== null && typeof nestedError === "object") {
    const nested = nestedError as Record<string, unknown>;
    if (typeof nested.code === "string" && nested.code.trim().length > 0) {
      return normalizeDenaliPhotoErrorCode(nested.code.trim());
    }
  }
  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return normalizeDenaliPhotoErrorCode(record.error.trim());
  }
  return null;
}

export function normalizeDenaliPhotoErrorCode(code: string): string {
  return PHOTO_ERROR_CODE_ALIASES[code] ?? code;
}

export function parseDenaliPhotoApiErrorCode(payload: unknown, status: number): string {
  const extracted = extractDenaliPhotoApiErrorCode(payload);
  if (extracted !== null) {
    return extracted;
  }
  return `PHOTO_UPLOAD_HTTP_${status}`;
}

/** Maps Denali wizard photo upload error codes to localized denali.composites.photos.uploadErrors keys. */
export function resolveDenaliPhotoUploadError(
  t: TranslateFn,
  code: string | null | undefined
): string {
  if (code === null || code === undefined || code.trim().length === 0) {
    return "";
  }
  const trimmed = code.trim();
  const httpMatch = PHOTO_UPLOAD_HTTP.exec(trimmed);
  if (httpMatch !== null) {
    try {
      return t("composites.photos.uploadErrors.PHOTO_UPLOAD_HTTP_ERROR", {
        status: httpMatch[1] ?? "",
      });
    } catch {
      return trimmed;
    }
  }
  try {
    return t(`composites.photos.uploadErrors.${trimmed}`);
  } catch {
    return resolveCodedErrorMessage(t, trimmed);
  }
}
