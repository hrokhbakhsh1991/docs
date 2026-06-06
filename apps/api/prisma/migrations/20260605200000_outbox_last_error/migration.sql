-- DEC-086 — terminal failed outbox carries last_error for ops replay triage.
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS last_error JSONB;
