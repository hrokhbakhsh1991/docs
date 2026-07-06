-- Non-superuser app role — required for RLS integration tests (BYPASSRLS sees all tenants).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tour') THEN
    CREATE ROLE app_tour LOGIN PASSWORD 'app_tour' NOSUPERUSER NOBYPASSRLS;
  ELSE
    ALTER ROLE app_tour WITH LOGIN PASSWORD 'app_tour' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_tour;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tour;

-- Grant CONNECT on known dev/CI database names when present.
DO $$
DECLARE
  db_name text;
BEGIN
  FOREACH db_name IN ARRAY ARRAY['tour_db', 'app_tour_dev'] LOOP
    IF EXISTS (SELECT 1 FROM pg_database WHERE datname = db_name) THEN
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_tour', db_name);
    END IF;
  END LOOP;
END
$$;

-- Tables created before default privileges (e.g. during init) need explicit grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tour;
