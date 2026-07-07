import type { MemberProfileViewPayload } from "./member-profile-types";

/** Distributed-cache-ready member profile view store (M6). */
export type MemberProfileCacheStore = {
  read(cacheKey: string, nowMs?: number): MemberProfileViewPayload | null;
  write(
    cacheKey: string,
    payload: MemberProfileViewPayload,
    ttlMs?: number,
    nowMs?: number
  ): void;
  invalidate(cacheKey: string): void;
  clear(): void;
};

type CacheEntry = {
  readonly payload: MemberProfileViewPayload;
  readonly expiresAt: number;
};

const DEFAULT_TTL_MS = 60_000;

export function createInMemoryMemberProfileCacheStore(): MemberProfileCacheStore {
  const profileViewCache = new Map<string, CacheEntry>();

  return {
    read(cacheKey, nowMs = Date.now()) {
      const entry = profileViewCache.get(cacheKey);
      if (entry === undefined) {
        return null;
      }
      if (entry.expiresAt <= nowMs) {
        profileViewCache.delete(cacheKey);
        return null;
      }
      return entry.payload;
    },
    write(cacheKey, payload, ttlMs = DEFAULT_TTL_MS, nowMs = Date.now()) {
      profileViewCache.set(cacheKey, {
        payload,
        expiresAt: nowMs + ttlMs,
      });
    },
    invalidate(cacheKey) {
      profileViewCache.delete(cacheKey);
    },
    clear() {
      profileViewCache.clear();
    },
  };
}

let activeStore: MemberProfileCacheStore = createInMemoryMemberProfileCacheStore();

export function getMemberProfileCacheStore(): MemberProfileCacheStore {
  return activeStore;
}

/** Test-only store swap — not used in production routes. */
export function setMemberProfileCacheStoreForTests(store: MemberProfileCacheStore): void {
  activeStore = store;
}

export function resetMemberProfileCacheStoreForTests(): void {
  activeStore = createInMemoryMemberProfileCacheStore();
}
