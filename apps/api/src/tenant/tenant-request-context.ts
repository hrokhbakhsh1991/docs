import { AsyncLocalStorage } from "node:async_hooks";

export type TenantRequestStore = {
  readonly tenantId: string;
  readonly actorId?: string;
  readonly workspaceType?: string;
};

export type TenantRequestContextOptions = {
  readonly actorId?: string;
  readonly workspaceType?: string;
};

const tenantRequestStorage = new AsyncLocalStorage<TenantRequestStore>();

/**
 * Runs work with the active tenant id in AsyncLocalStorage (Phase 4 execution layer).
 * Tour reads/writes must still use {@link withTenantRls} — ALS supplies the tenant scope.
 */
export function runWithTenantContext<T>(
  tenantId: string,
  run: () => Promise<T>,
  options?: TenantRequestContextOptions
): Promise<T> {
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    throw new Error("TENANT_CONTEXT_TENANT_ID_REQUIRED");
  }
  return tenantRequestStorage.run(
    {
      tenantId: normalized,
      actorId: options?.actorId?.trim() || undefined,
      workspaceType: options?.workspaceType?.trim() || undefined,
    },
    run
  );
}

/** Active tenant from ALS — undefined outside {@link runWithTenantContext}. */
export function getActiveTenantId(): string | undefined {
  return tenantRequestStorage.getStore()?.tenantId;
}

export function requireActiveTenantId(): string {
  const tenantId = getActiveTenantId();
  if (tenantId === undefined) {
    throw new Error("TENANT_CONTEXT_NOT_BOUND");
  }
  return tenantId;
}

/** Active actor from ALS — undefined when not supplied at context bind time. */
export function getActiveActorId(): string | undefined {
  return tenantRequestStorage.getStore()?.actorId;
}

/** Workspace type for audit metadata — defaults handled by callers. */
export function getActiveWorkspaceType(): string | undefined {
  return tenantRequestStorage.getStore()?.workspaceType;
}
