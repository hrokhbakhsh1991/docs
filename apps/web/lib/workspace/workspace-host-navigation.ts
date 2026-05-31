import { cancelInflightBffGets } from "@/lib/auth/inflight-bff-get";
import { clearSessionStorageMirrorForHostNavigation } from "@/lib/auth/session";
import {
  buildScopedStorageKey,
  createScopedSessionStorage,
  SCOPED_STORAGE_GLOBAL_TENANT,
} from "@/lib/storage/scoped-storage";

const STORAGE_NAMESPACE = "auth";
export const PENDING_WORKSPACE_SESSION_LOGICAL_KEY = "pending-workspace-tenant";

/** sessionStorage scoped key: finish `POST /auth/workspace/session` after cross-subdomain navigation. */
export const PENDING_WORKSPACE_SESSION_TENANT_KEY = buildScopedStorageKey(
  STORAGE_NAMESPACE,
  SCOPED_STORAGE_GLOBAL_TENANT,
  PENDING_WORKSPACE_SESSION_LOGICAL_KEY,
);

function pendingWorkspaceStorage() {
  return createScopedSessionStorage(STORAGE_NAMESPACE, SCOPED_STORAGE_GLOBAL_TENANT);
}

export function readPendingWorkspaceSessionTenantId(): string | null {
  const storage = pendingWorkspaceStorage();
  const legacy = "tour_ops_pending_workspace_tenant_id";
  return (
    storage.migrateLegacyItem(PENDING_WORKSPACE_SESSION_LOGICAL_KEY, legacy) ??
    storage.getItem(PENDING_WORKSPACE_SESSION_LOGICAL_KEY)
  );
}

export function writePendingWorkspaceSessionTenantId(tenantId: string): void {
  pendingWorkspaceStorage().setItem(PENDING_WORKSPACE_SESSION_LOGICAL_KEY, tenantId.trim());
}

export function clearPendingWorkspaceSessionTenantId(): void {
  pendingWorkspaceStorage().removeItem(PENDING_WORKSPACE_SESSION_LOGICAL_KEY);
}

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
    writePendingWorkspaceSessionTenantId(opts.workspace.tenant_id.trim());
  } catch {
    /* quota / private mode — fall through to in-place switch attempt */
    return false;
  }

  clearSessionStorageMirrorForHostNavigation();
  cancelInflightBffGets();

  const tail = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target = `${window.location.protocol}//${sub}.${root}${tail}`;

  queueMicrotask(() => {
    window.location.assign(target);
  });
  return true;
}
