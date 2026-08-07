/**
 * Shared TTL + LRU cache for finance lookups keyed by registrationId
 * (booking inspection strip: payments + invoice).
 */

export const FINANCE_REGISTRATION_FETCH_TTL_MS = 45_000;
export const FINANCE_REGISTRATION_FETCH_MAX_ENTRIES = 40;

type CacheEntry<T> = {
  readonly at: number;
  readonly value: T;
};

const caches = new Map<string, Map<string, CacheEntry<unknown>>>();

function bucket(namespace: string): Map<string, CacheEntry<unknown>> {
  let map = caches.get(namespace);
  if (map === undefined) {
    map = new Map();
    caches.set(namespace, map);
  }
  return map;
}

export function readFinanceRegistrationCache<T>(
  namespace: string,
  registrationId: string
): T | null {
  const id = registrationId.trim();
  if (id.length === 0) {
    return null;
  }
  const map = bucket(namespace);
  const cached = map.get(id);
  if (cached === undefined) {
    return null;
  }
  if (Date.now() - cached.at >= FINANCE_REGISTRATION_FETCH_TTL_MS) {
    map.delete(id);
    return null;
  }
  map.delete(id);
  map.set(id, cached);
  return cached.value as T;
}

export function writeFinanceRegistrationCache<T>(
  namespace: string,
  registrationId: string,
  value: T
): void {
  const id = registrationId.trim();
  if (id.length === 0) {
    return;
  }
  const map = bucket(namespace);
  map.set(id, { at: Date.now(), value });
  while (map.size > FINANCE_REGISTRATION_FETCH_MAX_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    map.delete(oldestKey);
  }
}

/** Test / HMR helper — clears one namespace or all. */
export function clearFinanceRegistrationCache(namespace?: string): void {
  if (namespace === undefined) {
    caches.clear();
    return;
  }
  caches.delete(namespace);
}
