/** Postgres `tenants.id` UUID shape — rejects dev string ids like `tenant-a`. */
export const TENANT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedTenantUuid(tenantId: string): boolean {
  return TENANT_UUID_PATTERN.test(tenantId.trim());
}
