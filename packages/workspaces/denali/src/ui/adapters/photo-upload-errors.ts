
type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const PHOTO_UPLOAD_HTTP = /^PHOTO_UPLOAD_HTTP_(\d+)$/;

const PHOTO_ERROR_CODE_ALIASES: Readonly<Record<string, string>> = {
  MINIO_NOT_CONFIGURED: "PHOTO_STORAGE_NOT_CONFIGURED",
  AUTH_UNAUTHENTICATED: "PHOTO_AUTH_REQUIRED",
  BACKEND_UNREACHABLE: "PHOTO_BACKEND_UNREACHABLE",
  INVALID_UPLOAD_HEADERS: "PHOTO_INVALID_UPLOAD_HEADERS",
  TENANT_DB_BUDGET_EXCEEDED: "PHOTO_SERVICE_BUSY",
  DB_POOL_SATURATED: "PHOTO_SERVICE_BUSY",
};

export const DENALI_PHOTO_UPLOAD_ERROR_MESSAGE_KEYS = [
  "PHOTO_INVALID_TYPE",
  "PHOTO_FILE_TOO_LARGE",
  "PHOTO_UPLOAD_IN_PROGRESS",
  "PHOTO_STORAGE_NOT_CONFIGURED",
  "PHOTO_STORAGE_FULL",
  "PHOTO_STORAGE_UNAVAILABLE",
  "PHOTO_AUTH_REQUIRED",
  "PHOTO_BACKEND_UNREACHABLE",
  "PHOTO_INVALID_UPLOAD_HEADERS",
  "PHOTO_PREVIEW_URL_MISSING",
  "PHOTO_PREVIEW_HTTPS_REQUIRED",
  "PHOTO_UPLOAD_HTTP_ERROR",
  "PHOTO_MISSING_STORAGE_KEY",
  "PHOTO_SERVICE_BUSY",
] as const;

const PHOTO_UPLOAD_ERROR_MESSAGE_KEY_SET = new Set<string>(
  DENALI_PHOTO_UPLOAD_ERROR_MESSAGE_KEYS
);

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

export function resolveDenaliPhotoUploadError(
  t: TranslateFn,
  code: string | null | undefined
): string {
  if (code === null || code === undefined || code.trim().length === 0) {
    return "";
  }
  const normalized = normalizeDenaliPhotoErrorCode(code.trim());
  const httpMatch = PHOTO_UPLOAD_HTTP.exec(normalized);
  if (httpMatch !== null) {
    return t("composites.photos.uploadErrors.PHOTO_UPLOAD_HTTP_ERROR", {
      status: httpMatch[1] ?? "",
    });
  }
  const messageKey = PHOTO_UPLOAD_ERROR_MESSAGE_KEY_SET.has(normalized)
    ? normalized
    : "PHOTO_SERVICE_BUSY";
  return t(`composites.photos.uploadErrors.${messageKey}`);
}
