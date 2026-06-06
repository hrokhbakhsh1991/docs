-- Phase 5.5 — audit_events append-only trigger

CREATE OR REPLACE FUNCTION reject_audit_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON "audit_events";
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_events_mutation();

GRANT SELECT, INSERT ON TABLE "audit_events" TO app_tour;
