-- REFERENCE ONLY — see apps/api/prisma/migrations/20260706100000_operator_registration_intake

ALTER TABLE operator_registrations
  ADD COLUMN IF NOT EXISTS registration_intake JSONB;
