-- Non-superuser app role — required for RLS integration tests (BYPASSRLS sees all tenants).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_cloud') THEN
    CREATE ROLE app_cloud LOGIN PASSWORD 'app_cloud' NOSUPERUSER NOBYPASSRLS;
  ELSE
    ALTER ROLE app_cloud WITH LOGIN PASSWORD 'app_cloud' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_cloud;
-- Prefer explicit GRANTs in migrations after ENABLE+FORCE RLS (TODO-002).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_cloud;

-- Grant CONNECT on known dev/CI database names when present.
DO $$
DECLARE
  db_name text;
BEGIN
  FOREACH db_name IN ARRAY ARRAY['tour_db', 'app_cloud_dev'] LOOP
    IF EXISTS (SELECT 1 FROM pg_database WHERE datname = db_name) THEN
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_cloud', db_name);
    END IF;
  END LOOP;
END
$$;

-- Tables created before default privileges (e.g. during init) need explicit grants.
-- Production migrations must pair GRANT with ENABLE+FORCE RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_cloud;
