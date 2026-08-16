type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const HTTP_ERROR_CODE = /^([A-Z0-9_]+)_HTTP_(\d+)$/;

/** Maps stable public-auth error codes to `catalogRegistration.errors.*`. */
export function resolveMarketingLoginError(t: TranslateFn, code: string | null | undefined): string {
  if (code === null || code === undefined || code.trim().length === 0) {
    return "";
  }
  const trimmed = code.trim();
  const httpMatch = HTTP_ERROR_CODE.exec(trimmed);
  if (httpMatch !== null) {
    const [, prefix, status] = httpMatch;
    try {
      return t(`errors.${prefix}_HTTP_ERROR`, { status });
    } catch {
      // fall through
    }
  }
  try {
    return t(`errors.${trimmed}`);
  } catch {
    return trimmed;
  }
}
