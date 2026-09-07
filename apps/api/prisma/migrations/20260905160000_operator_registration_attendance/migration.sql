-- DP-7 minimum attendance producer — day-of present/absent on approved registrations.
ALTER TABLE operator_registrations
  ADD COLUMN IF NOT EXISTS attendance_status TEXT,
  ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_marked_by_user_id UUID;

COMMENT ON COLUMN operator_registrations.attendance_status IS 'present | absent when operator marks day-of attendance';
COMMENT ON COLUMN operator_registrations.attendance_marked_at IS 'When attendance was marked (same TX as outbox attendance.marked)';
COMMENT ON COLUMN operator_registrations.attendance_marked_by_user_id IS 'Operator user id who marked attendance';
