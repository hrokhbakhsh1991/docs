import type { MemberProfileViewPayload } from "./member-profile-types";
import { MEMBER_PROFILE_CONTRACT_VERSION } from "./member-profile-contract.server";
import { getMemberProfileCacheStore } from "./member-profile-cache-store.server";

export type { MemberProfileCacheStore } from "./member-profile-cache-store.server";
export {
  createInMemoryMemberProfileCacheStore,
  getMemberProfileCacheStore,
} from "./member-profile-cache-store.server";

export function buildMemberProfileCacheKey(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly pluginId: string;
}): string {
  return `${MEMBER_PROFILE_CONTRACT_VERSION}:${input.tenantId}:${input.userId}:${input.pluginId}`;
}

export function readMemberProfileCache(
  cacheKey: string,
  nowMs = Date.now()
): MemberProfileViewPayload | null {
  return getMemberProfileCacheStore().read(cacheKey, nowMs);
}

export function writeMemberProfileCache(
  cacheKey: string,
  payload: MemberProfileViewPayload,
  ttlMs?: number,
  nowMs = Date.now()
): void {
  getMemberProfileCacheStore().write(cacheKey, payload, ttlMs, nowMs);
}

export function invalidateMemberProfileCache(cacheKey: string): void {
  getMemberProfileCacheStore().invalidate(cacheKey);
}

/** Test-only reset — not used in production routes. */
export function clearMemberProfileCacheForTests(): void {
  getMemberProfileCacheStore().clear();
}
