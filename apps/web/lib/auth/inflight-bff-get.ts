/**
 * Dedupes identical in-flight GETs (React Strict Mode double-mount in dev).
 */
const inflight = new Map<string, Promise<unknown>>();

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
