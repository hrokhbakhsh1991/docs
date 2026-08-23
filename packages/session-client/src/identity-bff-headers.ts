const ANONYMOUS_OTP_USER_ID = "00000000-0000-4000-8000-000000000099";

export type IdentityBffHeaderOptions = {
  readonly workspaceId?: string | null;
};

export function buildIdentityBffHeadersForTenant(
  host: string,
  tenantId: string,
  options: IdentityBffHeaderOptions = {}
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": ANONYMOUS_OTP_USER_ID,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": options.workspaceId?.trim() || "ws-operator-dev",
    host: host.split(":")[0] ?? host,
  };
}
