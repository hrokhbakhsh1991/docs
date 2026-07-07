import {
  DENALI_PHOTO_UPLOAD_ERROR_MESSAGE_KEYS,
  extractDenaliPhotoApiErrorCode,
  normalizeDenaliPhotoErrorCode,
  parseDenaliPhotoApiErrorCode,
  resolveDenaliPhotoUploadError,
} from "./photo-upload-errors";

export type PhotoUploadErrorsSurface = {
  readonly messageKeys: typeof DENALI_PHOTO_UPLOAD_ERROR_MESSAGE_KEYS;
  readonly extractApiErrorCode: typeof extractDenaliPhotoApiErrorCode;
  readonly normalizeErrorCode: typeof normalizeDenaliPhotoErrorCode;
  readonly parseApiErrorCode: typeof parseDenaliPhotoApiErrorCode;
  readonly resolvePhotoUploadError: typeof resolveDenaliPhotoUploadError;
};

export const denaliPhotoUploadErrorsSurface: PhotoUploadErrorsSurface = Object.freeze({
  messageKeys: DENALI_PHOTO_UPLOAD_ERROR_MESSAGE_KEYS,
  extractApiErrorCode: extractDenaliPhotoApiErrorCode,
  normalizeErrorCode: normalizeDenaliPhotoErrorCode,
  parseApiErrorCode: parseDenaliPhotoApiErrorCode,
  resolvePhotoUploadError: resolveDenaliPhotoUploadError,
});
