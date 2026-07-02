-- Persist portal registration intake metadata (transport + registrant target).
ALTER TABLE operator_registrations
  ADD COLUMN IF NOT EXISTS registration_intake JSONB;
