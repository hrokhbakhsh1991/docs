import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import {
  buildMemberEntitlementsCacheKey,
  readMemberEntitlementsCache,
  writeMemberEntitlementsCache,
} from "./member-entitlements-cache.server";

import {
  buildMemberEntitlementsPayload,
  type MemberEntitlementsPayload,
  resolveMemberEntitlementsPayload,
} from "./member-entitlements-bff.server";

function readSessionUserId(headers: Record<string, string>): string | null {
  const userId = headers["x-user-id"];
  return userId !== undefined && userId.trim().length > 0 ? userId.trim() : null;
}

/** Shell SSR entitlements — same auth + payload as GET /api/me/entitlements (DL-09). */
export async function resolveMemberEntitlementsForShell(
  host: string,
  bootstrap: { readonly tenantId: string; readonly pluginId: string }
): Promise<MemberEntitlementsPayload | null> {
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return null;
  }
  if (headers["x-tenant-id"] !== bootstrap.tenantId) {
    return null;
  }

  const sessionUserId = readSessionUserId(headers);
  if (sessionUserId !== null) {
    const cacheKey = buildMemberEntitlementsCacheKey({
      tenantId: bootstrap.tenantId,
      userId: sessionUserId,
      pluginId: bootstrap.pluginId,
    });
    const cached = readMemberEntitlementsCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const payload = await resolveMemberEntitlementsPayload({
      host,
      tenantId: bootstrap.tenantId,
      pluginId: bootstrap.pluginId,
      apiHeaders: headers,
    });
    writeMemberEntitlementsCache(cacheKey, payload);
    return payload;
  }

  return resolveMemberEntitlementsPayload({
    host,
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    apiHeaders: headers,
  });
}

export { buildMemberEntitlementsPayload };
