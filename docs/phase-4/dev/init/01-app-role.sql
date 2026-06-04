-- Non-superuser app role — required for RLS integration tests (superuser bypasses RLS).
CREATE ROLE app_tour LOGIN PASSWORD 'app_tour' NOSUPERUSER NOBYPASSRLS;
GRANT CONNECT ON DATABASE tour_db TO app_tour;
GRANT USAGE ON SCHEMA public TO app_tour;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tour;
