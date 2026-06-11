import { resolveCodedErrorMessage } from "./resolve-coded-error-message";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const PHOTO_UPLOAD_HTTP = /^PHOTO_UPLOAD_HTTP_(\d+)$/;

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
