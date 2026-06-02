import type { EntityManager } from "typeorm";

const METADATA_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export type MembershipMetadataJsonbPatchOptions = {
  membershipId: string;
  tenantId: string;
  /** Top-level keys merged with PostgreSQL `||` (preserves unrelated existing keys). */
  patch?: Record<string, unknown>;
  /** Top-level keys removed with PostgreSQL `-` (e.g. clearing `badges`). */
  removeKeys?: readonly string[];
};

function assertSafeMetadataKeys(keys: readonly string[]): void {
  for (const key of keys) {
    if (!METADATA_KEY_PATTERN.test(key)) {
      throw new Error(`Unsafe membership_metadata key: ${key}`);
    }
  }
}

/**
 * Database-level JSONB merge for `user_tenants.membership_metadata`.
 * Never replaces the whole document from a parsed DTO — unrelated keys stay intact.
 */
export async function applyMembershipMetadataJsonbPatch(
  manager: EntityManager,
  options: MembershipMetadataJsonbPatchOptions
): Promise<void> {
  const patch = options.patch ?? {};
  const removeKeys = options.removeKeys ?? [];
  const patchKeys = Object.keys(patch);
  assertSafeMetadataKeys(patchKeys);
  assertSafeMetadataKeys(removeKeys);

  if (patchKeys.length === 0 && removeKeys.length === 0) {
    return;
  }

  let expr = "COALESCE(membership_metadata, '{}'::jsonb)";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (patchKeys.length > 0) {
    expr = `(${expr} || $${paramIndex}::jsonb)`;
    params.push(JSON.stringify(patch));
    paramIndex += 1;
  }

  for (const key of removeKeys) {
    expr = `(${expr} - '${key}')`;
  }

  params.push(options.membershipId, options.tenantId);
  await manager.query(
    `UPDATE user_tenants
     SET membership_metadata = ${expr},
         session_version = session_version + 1,
         updated_at = now()
     WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} AND deleted_at IS NULL`,
    params
  );
}
