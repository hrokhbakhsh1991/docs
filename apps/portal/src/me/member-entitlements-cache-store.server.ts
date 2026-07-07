import type { MemberEntitlementsPayload } from "./member-entitlements-bff.server";

/** Distributed-cache-ready member entitlements store (DL-17). */
export type MemberEntitlementsCacheStore = {
  read(cacheKey: string, nowMs?: number): MemberEntitlementsPayload | null;
  write(
    cacheKey: string,
    payload: MemberEntitlementsPayload,
    ttlMs?: number,
    nowMs?: number
  ): void;
  invalidate(cacheKey: string): void;
  clear(): void;
};

type CacheEntry = {
  readonly payload: MemberEntitlementsPayload;
  readonly expiresAt: number;
};

const DEFAULT_TTL_MS = 30_000;

export function createInMemoryMemberEntitlementsCacheStore(): MemberEntitlementsCacheStore {
  const entitlementsCache = new Map<string, CacheEntry>();

  return {
    read(cacheKey, nowMs = Date.now()) {
      const entry = entitlementsCache.get(cacheKey);
      if (entry === undefined) {
        return null;
      }
      if (entry.expiresAt <= nowMs) {
        entitlementsCache.delete(cacheKey);
        return null;
      }
      return entry.payload;
    },
    write(cacheKey, payload, ttlMs = DEFAULT_TTL_MS, nowMs = Date.now()) {
      entitlementsCache.set(cacheKey, {
        payload,
        expiresAt: nowMs + ttlMs,
      });
    },
    invalidate(cacheKey) {
      entitlementsCache.delete(cacheKey);
    },
    clear() {
      entitlementsCache.clear();
    },
  };
}

let activeStore: MemberEntitlementsCacheStore = createInMemoryMemberEntitlementsCacheStore();

export function getMemberEntitlementsCacheStore(): MemberEntitlementsCacheStore {
  return activeStore;
}

/** Test-only store swap — not used in production routes. */
export function setMemberEntitlementsCacheStoreForTests(
  store: MemberEntitlementsCacheStore
): void {
  activeStore = store;
}

export function resetMemberEntitlementsCacheStoreForTests(): void {
  activeStore = createInMemoryMemberEntitlementsCacheStore();
}
