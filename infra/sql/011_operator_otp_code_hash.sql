-- REFERENCE ONLY (DEC-124) — see apps/api/prisma/migrations/20260609130000_operator_otp_code_hash

ALTER TABLE mobile_otp_challenges
  ADD COLUMN IF NOT EXISTS code_hash TEXT NOT NULL DEFAULT '';

-- Backfill not required — pre-1C.2 rows are dev-only and expired.
