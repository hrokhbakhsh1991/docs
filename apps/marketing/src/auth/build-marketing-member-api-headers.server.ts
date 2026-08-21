import {
  readMarketingMemberSessionFromCookies,
  readMarketingMemberSessionToken,
} from "./read-marketing-member-session.server";

export async function buildMarketingMemberApiHeaders(input: {
  readonly host: string;
  readonly tenantId: string;
}): Promise<Record<string, string>> {
  const session = await readMarketingMemberSessionFromCookies();
  if (session === null || session.tenantId !== input.tenantId) {
    return { "x-tenant-id": input.tenantId };
  }

  const token = await readMarketingMemberSessionToken();
  const headers: Record<string, string> = {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    "x-user-id": session.userId,
    "x-actor-role": session.role,
    "x-membership-status": "ACTIVE",
  };
  return token !== null ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}
