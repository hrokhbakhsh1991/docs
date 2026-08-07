type TranslateFn = (key: string) => string;

const HTTP_STATUS_SUFFIX = /^(.+)_HTTP_(\d+)$/;

const NETWORK_ERROR_MESSAGES = new Set([
  "failed to fetch",
  "load failed",
  "networkerror",
  "network error",
  "networkrequestfailed",
  "fetch failed",
]);

/**
 * Maps finance client error codes to stable i18n keys.
 * Convention: throw `RESOURCE_HTTP_<status>` or `RESOURCE_LIST_HTTP_<status>`;
 * i18n keys are `RESOURCE_FETCH_FAILED` / `RESOURCE_FAILED` under `finance.errors`.
 */
export function normalizeFinanceErrorCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (NETWORK_ERROR_MESSAGES.has(lower) || lower.startsWith("networkerror when attempting")) {
    return "NETWORK_ERROR";
  }

  // Explicit resource → i18n key (keeps throw sites and messages aligned).
  const explicit: Record<string, string> = {
    FINANCE_SUMMARY_HTTP_: "FINANCE_SUMMARY_FAILED",
    OVERVIEW_HTTP_: "OVERVIEW_FETCH_FAILED",
    LEDGER_HTTP_: "LEDGER_FETCH_FAILED",
    FINANCE_PAYMENTS_HTTP_: "PAYMENTS_FETCH_FAILED",
    INVOICE_HTTP_: "INVOICE_FETCH_FAILED",
    RECEIPT_REVIEW_HTTP_: "REVIEW_RECEIPT_FAILED",
    MANUAL_PAYMENT_HTTP_: "MANUAL_PAYMENT_FAILED",
    SUBMIT_RECEIPT_HTTP_: "SUBMIT_RECEIPT_FAILED",
    RECORD_PREPAYMENT_HTTP_: "RECORD_PREPAYMENT_FAILED",
    GENERATE_SCHEDULE_HTTP_: "GENERATE_SCHEDULE_FAILED",
    SCHEDULE_ITEM_PATCH_HTTP_: "SCHEDULE_ITEM_PATCH_FAILED",
  };
  for (const [prefix, key] of Object.entries(explicit)) {
    if (trimmed.startsWith(prefix)) {
      return key;
    }
  }
  if (trimmed === "RECEIPT_REVIEW_FAILED") {
    return "REVIEW_RECEIPT_FAILED";
  }
  if (trimmed === "SCHEDULE_ITEM_PATCH_INVALID") {
    return "SCHEDULE_ITEM_PATCH_FAILED";
  }

  const httpMatch = HTTP_STATUS_SUFFIX.exec(trimmed);
  if (httpMatch === null) {
    return trimmed;
  }
  const prefix = httpMatch[1] ?? "";
  if (prefix.endsWith("_LIST")) {
    // RECEIPTS_LIST / PAYMENTS_LIST / PREPAYMENTS_LIST / SCHEDULES_LIST
    const resource = prefix.slice(0, -"_LIST".length);
    return `${resource}_FETCH_FAILED`;
  }
  if (prefix.endsWith("_FETCH")) {
    return `${prefix}_FAILED`;
  }
  return trimmed;
}

/** Stable code from a caught client error (network TypeError → NETWORK_ERROR). */
export function toFinanceClientErrorCode(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return "NETWORK_ERROR";
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length === 0) {
      return fallback;
    }
    return normalizeFinanceErrorCode(message);
  }
  return fallback;
}

/** Maps stable finance error/validation codes to localized copy. */
export function resolveFinanceErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  const normalized = normalizeFinanceErrorCode(code);
  try {
    return t(normalized);
  } catch {
    return null;
  }
}

export function localizeFinanceMessage(
  tValidation: TranslateFn,
  tErrors: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  return (
    resolveFinanceErrorMessage(tValidation, code) ??
    resolveFinanceErrorMessage(tErrors, code) ??
    code
  );
}
