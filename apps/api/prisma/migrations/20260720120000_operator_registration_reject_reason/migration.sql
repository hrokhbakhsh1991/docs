-- Persist optional ops reject reason on operator registrations (Booking reject lifecycle).
ALTER TABLE operator_registrations
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;
