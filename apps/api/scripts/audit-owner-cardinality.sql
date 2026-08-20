-- Owner DB Hardening 1-A — live audit queries (admin / bypass-RLS).
-- Authority: docs/phase-9/appendices/owner-cardinality-db-hardening-1a.mdoc
-- Prefer DATABASE_URL_ADMIN. Do not auto-remediate.

-- 1) Multiple ACTIVE owners
SELECT
  ut.tenant_id::text AS tenant_id,
  COUNT(*)::int AS active_owner_count,
  array_agg(ut.user_id::text ORDER BY ut.created_at, ut.user_id) AS owner_user_ids
FROM user_tenants ut
WHERE ut.role = 'owner'
  AND ut.status = 'ACTIVE'
GROUP BY ut.tenant_id
HAVING COUNT(*) > 1
ORDER BY active_owner_count DESC, ut.tenant_id;

-- 2) Zero ACTIVE owners with at least one membership
--    Classify: provisioning (pending owner invite) vs invalid
WITH tenants_with_membership AS (
  SELECT DISTINCT tenant_id
  FROM user_tenants
),
active_owner_tenants AS (
  SELECT DISTINCT tenant_id
  FROM user_tenants
  WHERE role = 'owner'
    AND status = 'ACTIVE'
),
pending_owner_invites AS (
  SELECT DISTINCT tenant_id
  FROM operator_pending_invites
  WHERE role = 'owner'
    AND status = 'INVITED'
)
SELECT
  twm.tenant_id::text AS tenant_id,
  CASE
    WHEN poi.tenant_id IS NOT NULL THEN 'provisioning'
    ELSE 'invalid_active_tenant'
  END AS classification,
  (
    SELECT COUNT(*)::int
    FROM user_tenants ut
    WHERE ut.tenant_id = twm.tenant_id
  ) AS membership_count
FROM tenants_with_membership twm
LEFT JOIN active_owner_tenants aot ON aot.tenant_id = twm.tenant_id
LEFT JOIN pending_owner_invites poi ON poi.tenant_id = twm.tenant_id
WHERE aot.tenant_id IS NULL
ORDER BY classification, twm.tenant_id;

-- 3) Role distribution
SELECT role, COUNT(*)::int AS row_count
FROM user_tenants
GROUP BY role
ORDER BY row_count DESC, role;

-- 4) Status distribution
SELECT status, COUNT(*)::int AS row_count
FROM user_tenants
GROUP BY status
ORDER BY row_count DESC, status;

-- 5) Soft owners (role=owner, not ACTIVE)
SELECT
  ut.tenant_id::text AS tenant_id,
  ut.user_id::text AS user_id,
  ut.status,
  ut.created_at
FROM user_tenants ut
WHERE ut.role = 'owner'
  AND ut.status <> 'ACTIVE'
ORDER BY ut.tenant_id, ut.created_at;
