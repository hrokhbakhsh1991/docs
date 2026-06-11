const ANONYMOUS_OTP_USER_ID = "00000000-0000-4000-8000-000000000099";

export function buildIdentityBffHeadersForTenant(
  host: string,
  tenantId: string
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": ANONYMOUS_OTP_USER_ID,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id":
      process.env.TOUR_OPS_DEV_WORKSPACE_ID?.trim() ??
      process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID?.trim() ??
      "ws-operator-dev",
    host: host.split(":")[0] ?? host,
  };
}
