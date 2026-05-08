/** sessionStorage key: finish `POST /auth/workspace/session` after cross-subdomain navigation. */
export const PENDING_WORKSPACE_SESSION_TENANT_KEY = "tour_ops_pending_workspace_tenant_id";

export function readTenantRootDomainFromPublicEnv(): string | undefined {
  const r = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN?.trim();
  return r || undefined;
}

/**
 * When subdomain routing is configured, switching workspaces requires navigating to the target host
 * before exchanging the session JWT (API enforces body.tenant_id ↔ Host).
 *
 * @returns true when a full navigation was scheduled (caller must not await API).
 */
export function scheduleWorkspaceHostNavigationIfNeeded(opts: {
  workspace: { tenant_id: string; tenant_subdomain?: string };
  currentTenantId: string;
}): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const root = readTenantRootDomainFromPublicEnv();
  const sub = opts.workspace.tenant_subdomain?.trim();
  if (!root || !sub) {
    return false;
  }
  if (
    opts.workspace.tenant_id.trim().toLowerCase() === opts.currentTenantId.trim().toLowerCase()
  ) {
    return false;
  }
  try {
    sessionStorage.setItem(PENDING_WORKSPACE_SESSION_TENANT_KEY, opts.workspace.tenant_id.trim());
  } catch {
    /* quota / private mode — fall through to in-place switch attempt */
    return false;
  }
  const tail = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`${window.location.protocol}//${sub}.${root}${tail}`);
  return true;
}
