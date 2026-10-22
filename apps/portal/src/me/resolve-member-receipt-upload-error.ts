type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const SAFE_ERROR_CODE = /^[A-Z0-9_]{1,80}$/;

const RECEIPT_ERROR_KEYS: Readonly<Record<string, string>> = {
  AUTH_UNAUTHENTICATED: "errorAuthentication",
  BACKEND_UNREACHABLE: "errorConnection",
  FINANCE_RECEIPT_NOT_REQUIRED: "errorNoPaymentDue",
  MINIO_NOT_CONFIGURED: "errorStorageUnavailable",
  NETWORK_ERROR: "errorConnection",
  PAYMENT_DESTINATION_REVISION_UNAVAILABLE: "errorPaymentInstructionsChanged",
  RECEIPT_EVIDENCE_REQUIRED: "errorEvidenceRequired",
  RECEIPT_NOTE_MAX: "errorNoteTooLong",
  RECEIPT_PROOF_CONTENT_TYPE_INVALID: "errorFileType",
  RECEIPT_PROOF_TOO_LARGE: "errorFileTooLarge",
  RECEIPT_STORAGE_FULL: "errorStorageUnavailable",
  RECEIPT_STORAGE_UNAVAILABLE: "errorStorageUnavailable",
};

export function readMemberReceiptUploadErrorCode(
  payload: unknown,
  fallback = "RECEIPT_UPLOAD_FAILED"
): string {
  if (typeof payload !== "object" || payload === null) {
    return fallback;
  }
  const code = (payload as Record<string, unknown>).code;
  return typeof code === "string" && SAFE_ERROR_CODE.test(code) ? code : fallback;
}

export function resolveMemberReceiptUploadError(
  t: TranslateFn,
  code: string | null | undefined
): string {
  const safeCode = code && SAFE_ERROR_CODE.test(code) ? code : null;
  if (safeCode === null) {
    return t("failed");
  }
  const key = RECEIPT_ERROR_KEYS[safeCode];
  return key !== undefined ? t(key) : t("failedWithCode", { code: safeCode });
}
