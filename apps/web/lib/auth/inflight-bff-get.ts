/**
 * Dedupes identical in-flight GETs (React Strict Mode double-mount in dev).
 */

/** Same-origin BFF defaults — required so the HttpOnly `session` cookie is sent. */
export const BFF_BROWSER_FETCH_INIT: Readonly<RequestInit> = {
  credentials: "include",
  cache: "no-store",
};

/**
 * Browser `fetch` to Next.js `/api/*` routes with session cookie credentials.
 * Nest cross-origin calls must use `apiClient` + Bearer mirror (`lib/api-client.ts`).
 */
export function bffBrowserFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...BFF_BROWSER_FETCH_INIT,
    ...init,
    credentials: init?.credentials ?? "include",
  });
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Dedupes in-flight GETs (e.g. React Strict Mode double-mount).
 * Cache the **parsed** result — never a `Response`, whose body can only be read once.
 */
export function inflightBffGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
