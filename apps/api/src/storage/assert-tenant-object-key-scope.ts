/**
 * SK4.D — shared blob ACL: tenant-path-isolation.
 * @see docs/phase-saas-kernel/appendices/SK4_OBJ_IMPLEMENTATION.md
 */

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TENANT_OBJECT_KEY_SCOPE_INVALID = "TENANT_OBJECT_KEY_SCOPE_INVALID";

/**
 * Fail-closed: storageKey must embed tenantId as owning path segment.
 * Accepted:
 * - `${tenantId}/...` (branding, avatar, workspace media, …)
 * - `receipts/${tenantId}/...` (member receipt proofs)
 */
export function assertTenantOwnsObjectKey(storageKey: string, tenantId: string): void {
  const tid = tenantId.trim().toLowerCase();
  const key = storageKey.trim();
  if (!UUID_SEGMENT.test(tid)) {
    throw new Error(TENANT_OBJECT_KEY_SCOPE_INVALID);
  }
  if (key.length === 0 || key.includes("..") || key.includes("//") || key.startsWith("/")) {
    throw new Error(TENANT_OBJECT_KEY_SCOPE_INVALID);
  }
  if (key.startsWith(`${tid}/`) || key.startsWith(`receipts/${tid}/`)) {
    return;
  }
  throw new Error(TENANT_OBJECT_KEY_SCOPE_INVALID);
}
