export const TENANT_DB_BUDGET_EXCEEDED = "TENANT_DB_BUDGET_EXCEEDED";

const DEFAULT_MAX_CONCURRENT_DB_OPS = 4;

const activeByTenant = new Map<string, number>();

export class TenantDbBudgetExceededError extends Error {
  readonly code = TENANT_DB_BUDGET_EXCEEDED;

  constructor(public readonly maxOps: number) {
    super(TENANT_DB_BUDGET_EXCEEDED);
    this.name = "TenantDbBudgetExceededError";
  }
}

export function isTenantDbBudgetExceededError(
  error: unknown
): error is TenantDbBudgetExceededError {
  return error instanceof TenantDbBudgetExceededError;
}

export function resolveTenantMaxConcurrentDbOps(): number {
  const raw = process.env.TENANT_MAX_CONCURRENT_DB_OPS?.trim();
  if (!raw) {
    return DEFAULT_MAX_CONCURRENT_DB_OPS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_CONCURRENT_DB_OPS;
}

function acquireTenantDbSlot(tenantId: string): void {
  const normalized = tenantId.trim();
  const maxOps = resolveTenantMaxConcurrentDbOps();
  const active = activeByTenant.get(normalized) ?? 0;
  if (active >= maxOps) {
    throw new TenantDbBudgetExceededError(maxOps);
  }
  activeByTenant.set(normalized, active + 1);
}

function releaseTenantDbSlot(tenantId: string): void {
  const normalized = tenantId.trim();
  const active = activeByTenant.get(normalized) ?? 0;
  if (active <= 1) {
    activeByTenant.delete(normalized);
    return;
  }
  activeByTenant.set(normalized, active - 1);
}

/** Test-only — active app-pool TX count for a tenant. */
export function getActiveTenantDbOpsForTests(tenantId: string): number {
  return activeByTenant.get(tenantId.trim()) ?? 0;
}

/** Test-only — reset counters between specs. */
export function resetTenantConnectionBudgetForTests(): void {
  activeByTenant.clear();
}

/**
 * Per-tenant app-pool semaphore (DEC-055 / SCAL-DEBT-01).
 * Non-blocking — throws before Prisma opens a transaction when tenant is at cap.
 */
export async function withTenantDbBudget<T>(tenantId: string, run: () => Promise<T>): Promise<T> {
  acquireTenantDbSlot(tenantId);
  try {
    return await run();
  } finally {
    releaseTenantDbSlot(tenantId);
  }
}
