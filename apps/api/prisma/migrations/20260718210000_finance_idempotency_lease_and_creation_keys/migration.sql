-- Phase 4B remediation: HTTP idempotency leases + finance create/submit business keys.
-- Rollout: apply migration before (or with) new API pods; keep NULL lease + created_at
-- fallback reclaim until all writers set lease_until / lease_owner.

-- HttpIdempotencyRecord lease fields
ALTER TABLE "http_idempotency_records"
  ADD COLUMN IF NOT EXISTS "lease_until" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lease_owner" TEXT;

CREATE INDEX IF NOT EXISTS "http_idempotency_records_status_lease_until_idx"
  ON "http_idempotency_records" ("status", "lease_until");

-- Backfill in-flight processing rows so mixed-fleet reclaim does not treat them as
-- immediately expired NULL leases (legacy writers omit lease columns).
UPDATE "http_idempotency_records"
SET
  "lease_until" = "created_at" + INTERVAL '120 seconds',
  "lease_owner" = COALESCE("lease_owner", 'legacy-backfill')
WHERE "status" = 'processing'
  AND "lease_until" IS NULL;

-- Manual payment create business idempotency (not providerPaymentId)
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "creation_idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_tenant_id_creation_idempotency_key_key"
  ON "payments" ("tenant_id", "creation_idempotency_key");

-- Receipt submit business idempotency
ALTER TABLE "payment_receipts"
  ADD COLUMN IF NOT EXISTS "idempotency_key_hash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_tenant_id_idempotency_key_hash_key"
  ON "payment_receipts" ("tenant_id", "idempotency_key_hash");
