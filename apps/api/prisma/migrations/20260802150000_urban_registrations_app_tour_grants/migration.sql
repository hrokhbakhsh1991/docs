-- Release integrity: urban_registrations RLS landed in 20260720160000 with a
-- conditional DO-block GRANT. Mirror outbox/tours grant tip style — unconditional
-- GRANT so CI (01-app-role.sql before migrate) always has table privilege.
-- RLS policy urban_registrations_tenant_isolation still applies (TODO-002).
-- @see docs/phase-20/p7/appendices/BOOKING_HTTP_POSTGRES_CERT.md
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE urban_registrations TO app_tour;
