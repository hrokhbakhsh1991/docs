type TranslateFn = (key: string) => string;

/** Maps stable finance error/validation codes to localized copy. */
export function resolveFinanceErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string | null {
  if (code === null || code === undefined || code.trim().length === 0) {
    return null;
  }
  try {
    return t(code);
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
