-- DEC-024 / DM-CT-02 — runtime app role must not bypass RLS (P4-E-RLS-01).
-- Superuser and BYPASSRLS both skip policies even with FORCE ROW LEVEL SECURITY.
ALTER ROLE app_tour NOSUPERUSER NOBYPASSRLS;
