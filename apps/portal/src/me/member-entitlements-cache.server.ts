import type { MemberEntitlementsPayload } from "./member-entitlements-bff.server";
import { getMemberEntitlementsCacheStore } from "./member-entitlements-cache-store.server";

export type { MemberEntitlementsCacheStore } from "./member-entitlements-cache-store.server";
export {
  createInMemoryMemberEntitlementsCacheStore,
  getMemberEntitlementsCacheStore,
} from "./member-entitlements-cache-store.server";

const MEMBER_ENTITLEMENTS_CONTRACT_VERSION = "mps-ent-1";
const MAX_TTL_MS = 30_000;

export function resolveMemberEntitlementsBffCacheTtlMs(): number {
  const raw = process.env.MEMBER_ENTITLEMENTS_BFF_CACHE_TTL_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return MAX_TTL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, MAX_TTL_MS);
}

export function buildMemberEntitlementsCacheKey(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly pluginId: string;
}): string {
  return `${MEMBER_ENTITLEMENTS_CONTRACT_VERSION}:${input.tenantId}:${input.userId}:${input.pluginId}`;
}

export function readMemberEntitlementsCache(
  cacheKey: string,
  nowMs = Date.now()
): MemberEntitlementsPayload | null {
  if (resolveMemberEntitlementsBffCacheTtlMs() === 0) {
    return null;
  }
  return getMemberEntitlementsCacheStore().read(cacheKey, nowMs);
}

export function writeMemberEntitlementsCache(
  cacheKey: string,
  payload: MemberEntitlementsPayload,
  nowMs = Date.now()
): void {
  const ttlMs = resolveMemberEntitlementsBffCacheTtlMs();
  if (ttlMs === 0) {
    return;
  }
  getMemberEntitlementsCacheStore().write(cacheKey, payload, ttlMs, nowMs);
}

export function invalidateMemberEntitlementsCache(cacheKey: string): void {
  getMemberEntitlementsCacheStore().invalidate(cacheKey);
}

export function invalidateMemberEntitlementsCacheForMember(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly pluginId: string;
}): void {
  invalidateMemberEntitlementsCache(buildMemberEntitlementsCacheKey(input));
}

export function resolveMemberEntitlementsCacheControlHeader(): string {
  const ttlMs = resolveMemberEntitlementsBffCacheTtlMs();
  if (ttlMs === 0) {
    return "private, no-store";
  }
  const maxAgeSeconds = Math.max(1, Math.floor(ttlMs / 1000));
  return `private, max-age=${maxAgeSeconds}`;
}

/** Test-only reset — not used in production routes. */
export function clearMemberEntitlementsCacheForTests(): void {
  getMemberEntitlementsCacheStore().clear();
}
