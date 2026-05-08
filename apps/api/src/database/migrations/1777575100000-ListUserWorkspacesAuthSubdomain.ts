import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Exposes `tenants.subdomain` on workspace picker payloads (`list_user_workspaces_for_auth`)
 * so clients can navigate Host-aligned subdomains before `POST /auth/workspace/session`.
 */
export class ListUserWorkspacesAuthSubdomain1777575100000 implements MigrationInterface {
  name = "ListUserWorkspacesAuthSubdomain1777575100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.list_user_workspaces_for_auth(uuid)
    `);

    await queryRunner.query(`
      CREATE FUNCTION list_user_workspaces_for_auth(p_user_id uuid)
      RETURNS TABLE (
        tenant_id text,
        tenant_name text,
        tenant_subdomain text,
        role text,
        session_version integer
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT ut.tenant_id::text AS tenant_id,
               t.name::text AS tenant_name,
               COALESCE(NULLIF(trim(t.subdomain), ''), '')::text AS tenant_subdomain,
               ut.role::text AS role,
               ut.session_version::integer AS session_version
        FROM user_tenants ut
        INNER JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL
        WHERE ut.user_id = p_user_id
          AND ut.deleted_at IS NULL
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION list_user_workspaces_for_auth(uuid) TO CURRENT_USER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO tour_ops;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.list_user_workspaces_for_auth(uuid)
    `);

    await queryRunner.query(`
      CREATE FUNCTION list_user_workspaces_for_auth(p_user_id uuid)
      RETURNS TABLE (
        tenant_id text,
        tenant_name text,
        role text,
        session_version integer
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT ut.tenant_id::text AS tenant_id,
               t.name::text AS tenant_name,
               ut.role::text AS role,
               ut.session_version::integer AS session_version
        FROM user_tenants ut
        INNER JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL
        WHERE ut.user_id = p_user_id
          AND ut.deleted_at IS NULL
      $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION list_user_workspaces_for_auth(uuid) TO CURRENT_USER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO tour_ops;
        END IF;
      END $$
    `);
  }
}
