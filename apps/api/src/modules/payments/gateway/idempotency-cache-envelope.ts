import { SecurityIsolationBreachException } from "../../../common/errors/security-isolation-breach.exception";

export type IdempotencyCacheEnvelope<T> = {
  tenantId: string;
  value: T;
};

function normalizeTenantId(tenantId: string): string {
  return tenantId.trim().toLowerCase();
}

export function wrapIdempotencyCacheValue<T>(
  tenantId: string,
  value: T
): IdempotencyCacheEnvelope<T> {
  return {
    tenantId: tenantId.trim(),
    value,
  };
}

export function unwrapIdempotencyCacheValue<T>(activeTenantId: string, raw: unknown): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SecurityIsolationBreachException();
  }
  const envelope = raw as Partial<IdempotencyCacheEnvelope<T>>;
  if (typeof envelope.tenantId !== "string" || envelope.tenantId.trim().length === 0) {
    throw new SecurityIsolationBreachException();
  }
  if (normalizeTenantId(envelope.tenantId) !== normalizeTenantId(activeTenantId)) {
    throw new SecurityIsolationBreachException();
  }
  return envelope.value as T;
}

export function assertIdempotencyTenantScope(
  storedTenantId: string,
  activeTenantId: string
): void {
  if (normalizeTenantId(storedTenantId) !== normalizeTenantId(activeTenantId)) {
    throw new SecurityIsolationBreachException();
  }
}
