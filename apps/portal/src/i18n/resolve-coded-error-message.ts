type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const HTTP_ERROR_CODE = /^([A-Z0-9_]+)_HTTP_(\d+)$/;

/** Maps stable error codes (and `*_HTTP_<status>` variants) to localized copy when keys exist. */
export function resolveCodedErrorMessage(
  t: TranslateFn,
  code: string | null | undefined
): string {
  if (code === null || code === undefined || code.trim().length === 0) {
    return "";
  }
  const trimmed = code.trim();
  const httpMatch = HTTP_ERROR_CODE.exec(trimmed);
  if (httpMatch !== null) {
    const [, prefix, status] = httpMatch;
    const httpKey = `${prefix}_HTTP_ERROR`;
    try {
      return t(httpKey, { status });
    } catch {
      // fall through to raw code
    }
  }
  try {
    return t(trimmed);
  } catch {
    return trimmed;
  }
}
