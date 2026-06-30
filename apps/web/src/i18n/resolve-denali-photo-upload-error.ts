/** Re-export canonical Denali photo error codec — do not duplicate logic here. */
export {
  DENALI_PHOTO_UPLOAD_ERROR_MESSAGE_KEYS,
  extractDenaliPhotoApiErrorCode,
  normalizeDenaliPhotoErrorCode,
  parseDenaliPhotoApiErrorCode,
  resolveDenaliPhotoUploadError,
} from "@app-tour/workspace-denali/ui/adapters/photo-upload-errors";
