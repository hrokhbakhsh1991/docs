-- Release integrity: tenant_routes / tours created without GRANTs to app_tour.
-- CI applies 01-app-role.sql before migrate, so ALTER DEFAULT PRIVILEGES does not
-- cover later postgres-owned tables. RLS policies still apply after GRANT.
-- @see docs/phase-20/p7/appendices/BOOKING_HTTP_POSTGRES_CERT.md
GRANT SELECT ON TABLE tenant_routes TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tours TO app_tour;
