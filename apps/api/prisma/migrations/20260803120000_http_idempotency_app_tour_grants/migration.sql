-- Release integrity: http_idempotency_records created in 20260605160000 without GRANTs
-- to app_tour. CI applies 01-app-role.sql before migrate, so ALTER DEFAULT PRIVILEGES
-- does not cover later postgres-owned tables. RLS policy http_idempotency_tenant_isolation
-- still applies after GRANT (finance prepay / IDEM-* suites under Phase 5 / ci:integrity).
-- @see docs/phase-5/appendices/migration-head-preflight.md
-- @see docs/phase-20/p7/appendices/BOOKING_HTTP_POSTGRES_CERT.md (app-role privilege pattern)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE http_idempotency_records TO app_tour;
