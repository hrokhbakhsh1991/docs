# Owner Cardinality Audit Report

**Timestamp:** 2026-08-20 (cloud agent session)

**Connection:** *not available* — `DATABASE_URL_ADMIN` / `DATABASE_URL` unset in Cloud Agent environment.

**Index apply gate (multi-ACTIVE-owner):** **BLOCKED — staging audit not yet run**

> Auto-fix is forbidden. Manual actions only.

## Environment blocker

Cloud Agent requested secrets:

- `DATABASE_URL_ADMIN` (required) — staging admin / bypass-RLS
- `DATABASE_URL` (optional)

After secrets are available, run:

```bash
pnpm --filter @apps/api run audit:owner-cardinality
```

This regenerates this report from live queries in `apps/api/scripts/audit-owner-cardinality.sql`.

## Expected sections (when live)

1. Multiple ACTIVE owners
2. Zero ACTIVE owners (provisioning vs invalid)
3. Role distribution
4. Status distribution
5. Soft owners

## Apply gate

Do **not** apply `uq_user_tenants_one_active_owner` to staging/production until this report shows **GREEN** for multi-ACTIVE-owner count = 0.

Migration file is prepared with the same preflight (`OWNER_CARDINALITY_AUDIT_FAILED`) so apply fails closed if data is dirty.
