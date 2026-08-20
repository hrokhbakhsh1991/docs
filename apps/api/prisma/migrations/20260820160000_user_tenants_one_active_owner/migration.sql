-- Owner DB Hardening 1-A — exactly one ACTIVE owner (defense in depth).
-- Authority: docs/phase-9/appendices/owner-cardinality-db-hardening-1a.mdoc
-- DEC-OWN-DB-001 / DEC-OWN-DB-003
--
-- Preflight: abort if any tenant already has >1 ACTIVE owner.
-- Zero ACTIVE owners remain allowed (provisioning window with pending owner invite).
-- No trigger. Owner lifecycle unchanged.

DO $$
DECLARE
  multi_owner_tenants int;
BEGIN
  SELECT COUNT(*)::int INTO multi_owner_tenants
  FROM (
    SELECT tenant_id
    FROM user_tenants
    WHERE role = 'owner'
      AND status = 'ACTIVE'
    GROUP BY tenant_id
    HAVING COUNT(*) > 1
  ) violators;

  IF multi_owner_tenants > 0 THEN
    RAISE EXCEPTION
      'OWNER_CARDINALITY_AUDIT_FAILED: % tenant(s) have multiple ACTIVE owners — remediate before creating uq_user_tenants_one_active_owner',
      multi_owner_tenants;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tenants_one_active_owner
  ON user_tenants (tenant_id)
  WHERE role = 'owner'
    AND status = 'ACTIVE';
