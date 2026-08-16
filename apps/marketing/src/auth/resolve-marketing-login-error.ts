type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const HTTP_ERROR_CODE = /^([A-Z0-9_]+)_HTTP_(\d+)$/;

function looksLikeUnresolvedKey(message: string, key: string): boolean {
  return message === key || message.endsWith(`.${key}`);
}

function tryNetworkFallback(t: TranslateFn, fallback: string): string {
  try {
    const network = t("errors.network");
    if (looksLikeUnresolvedKey(network, "errors.network") || looksLikeUnresolvedKey(network, "network")) {
      return fallback;
    }
    return network;
  } catch {
    return fallback;
  }
}

/** Maps stable public-auth error codes to `catalogRegistration.errors.*`. */
export function resolveMarketingLoginError(t: TranslateFn, code: string | null | undefined): string {
  if (code === null || code === undefined || code.trim().length === 0) {
    return "";
  }
  const trimmed = code.trim();
  const httpMatch = HTTP_ERROR_CODE.exec(trimmed);
  if (httpMatch !== null) {
    const [, prefix, status] = httpMatch;
    const httpKey = `errors.${prefix}_HTTP_ERROR`;
    try {
      const mapped = t(httpKey, { status });
      if (!looksLikeUnresolvedKey(mapped, httpKey) && !looksLikeUnresolvedKey(mapped, `${prefix}_HTTP_ERROR`)) {
        return mapped;
      }
    } catch {
      // fall through
    }
  }
  const errorKey = `errors.${trimmed}`;
  try {
    const message = t(errorKey);
    if (looksLikeUnresolvedKey(message, errorKey) || looksLikeUnresolvedKey(message, trimmed)) {
      return tryNetworkFallback(t, trimmed);
    }
    return message;
  } catch {
    return tryNetworkFallback(t, trimmed);
  }
}
