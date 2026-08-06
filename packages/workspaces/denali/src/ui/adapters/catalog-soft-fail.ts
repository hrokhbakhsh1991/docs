const HTTP_ERROR_CODE = /^([A-Z0-9_]+)_HTTP_(\d+)$/;
const LOAD_FAILED_CODE = /_LOAD_FAILED$/;
const NETWORK_FAILURE_MARKERS = ["failed to fetch", "networkerror", "load failed", "fetch failed"];

/**
 * ED-UX-01 / ED-UX-02 — catalog BFF 5xx/429 and network/`*_LOAD_FAILED` must not present as
 * blocking validation. Save/publish still runs; pickers simply render empty until recovery.
 */
export function isDenaliCatalogHttpSoftFail(code: string | null | undefined): boolean {
  return isDenaliCatalogSoftFail(code);
}

/** Prefer this name; `isDenaliCatalogHttpSoftFail` remains as a stable alias. */
export function isDenaliCatalogSoftFail(code: string | null | undefined): boolean {
  if (code === null || code === undefined) {
    return false;
  }
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const httpMatch = HTTP_ERROR_CODE.exec(trimmed);
  if (httpMatch !== null) {
    const status = Number(httpMatch[2]);
    return status === 429 || (status >= 500 && status <= 599);
  }

  if (LOAD_FAILED_CODE.test(trimmed)) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  return NETWORK_FAILURE_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * One retry on soft-fail (cold Next BFF compile / transient 5xx/network) before surfacing degraded UI.
 */
export async function fetchDenaliCatalogJsonWithSoftRetry<T>(
  url: string,
  httpCodePrefix: string,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const attempt = async (): Promise<T> => {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${httpCodePrefix}_HTTP_${response.status}`);
    }
    return (await response.json()) as T;
  };

  try {
    return await attempt();
  } catch (first: unknown) {
    const message = first instanceof Error ? first.message : "CATALOG_LOAD_FAILED";
    if (!isDenaliCatalogSoftFail(message)) {
      throw first instanceof Error ? first : new Error(message);
    }
    return await attempt();
  }
}
