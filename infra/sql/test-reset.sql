-- Local RLS / integration fast reset — truncates tenant data, preserves schema + RLS policies.
-- Does not DROP tables or policies. Apply after migrations (001 + optional 002).
-- Usage: scripts/db-test-reset.sh

TRUNCATE TABLE
  outbox_events,
  audit_events,
  tours,
  tenants
RESTART IDENTITY CASCADE;
