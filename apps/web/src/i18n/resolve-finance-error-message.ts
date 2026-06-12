type TranslateFn = (key: string) => string;

/** Maps stable finance error/validation codes to localized copy. */
export function resolveFinanceErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  const normalized = code.startsWith("FINANCE_SUMMARY_HTTP_")
    ? "FINANCE_SUMMARY_FAILED"
    : code.startsWith("OVERVIEW_HTTP_")
      ? "OVERVIEW_FETCH_FAILED"
      : code;
  try {
    return t(normalized);
  } catch {
    return code;
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
