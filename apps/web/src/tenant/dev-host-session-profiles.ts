import type { TenantKernelResolveInput } from "./tenant-kernel.types";
import { readDevE2eSmokeHostLabel } from "./resolve-dev-e2e-host-bypass";

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

export function hasDevHostSmokeSessionProfile(host: string): boolean {
  const label = readDevE2eSmokeHostLabel(host);
  if (label === null) {
    return false;
  }
  return DEV_HOST_SESSION_PROFILE_KEYS.has(label);
}

export function resolveDevSessionProfileFromHost(
  host: string
): Partial<TenantKernelResolveInput> | null {
  const label = readDevE2eSmokeHostLabel(host);
  if (label === null) {
    return null;
  }
  return DEV_HOST_SESSION_PROFILES[label] ?? null;
}
