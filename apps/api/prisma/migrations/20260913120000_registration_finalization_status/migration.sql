ALTER TABLE "operator_registrations"
  ADD COLUMN "finalization_status" TEXT NOT NULL DEFAULT 'not_final',
  ADD COLUMN "finalized_at" TIMESTAMP(3),
  ADD COLUMN "finalized_by_user_id" UUID;

-- Preserve the pre-existing meaning of the final roster for already-settled rows.
UPDATE "operator_registrations"
SET "finalization_status" = 'finalized',
    "finalized_at" = COALESCE("approved_at", "updated_at")
WHERE "status" = 'approved'
  AND "payment_status" = 'paid';
