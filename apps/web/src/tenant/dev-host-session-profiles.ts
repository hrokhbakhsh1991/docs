import type { TenantKernelResolveInput } from "./tenant-kernel.types";

const WORKSPACE_SMOKE_E2E_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const WORKSPACE_SMOKE_E2E_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";
const WORKSPACE_SMOKE_E2E_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000402";

/** Dev e2e host labels → session profile overrides (PSC-001 Phase 2 — single SoT). */
export const DEV_HOST_SESSION_PROFILES: Readonly<
  Record<string, Partial<TenantKernelResolveInput>>
> = Object.freeze({
  "deny-theme": {
    userId: "deny-theme-user",
    role: "member",
    status: "SUSPENDED",
  },
  "workspace-owner-smoke": {
    userId: WORKSPACE_SMOKE_E2E_OWNER_USER_ID,
    workspaceId: WORKSPACE_SMOKE_E2E_WORKSPACE_ID,
    role: "owner",
    status: "ACTIVE",
  },
  "workspace-member-smoke": {
    userId: WORKSPACE_SMOKE_E2E_MEMBER_USER_ID,
    workspaceId: WORKSPACE_SMOKE_E2E_WORKSPACE_ID,
    role: "member",
    status: "ACTIVE",
  },
});

export const DEV_HOST_SESSION_PROFILE_KEYS = new Set(Object.keys(DEV_HOST_SESSION_PROFILES));

/** Caller must gate with isDevWebSessionAllowed() (Edge middleware env inlining). */
export function hasDevHostSmokeSessionProfile(host: string): boolean {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return false;
  }
  return DEV_HOST_SESSION_PROFILE_KEYS.has(match[1]);
}

export function resolveDevSessionProfileFromHost(
  host: string
): Partial<TenantKernelResolveInput> | null {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return null;
  }
  return DEV_HOST_SESSION_PROFILES[match[1]] ?? null;
}
