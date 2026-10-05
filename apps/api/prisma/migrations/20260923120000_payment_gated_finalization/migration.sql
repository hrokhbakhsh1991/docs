-- Final-roster membership is payment-gated.
-- Keep the registration and payment sources separate, but remove the stale
-- combination that could make an approved unpaid booking look finalized.
UPDATE "operator_registrations"
SET
  "finalization_status" = 'not_final',
  "finalized_at" = NULL,
  "finalized_by_user_id" = NULL
WHERE "status" = 'approved'
  AND "payment_status" <> 'paid'
  AND "finalization_status" = 'finalized';
