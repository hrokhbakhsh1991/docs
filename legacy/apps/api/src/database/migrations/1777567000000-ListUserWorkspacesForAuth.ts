import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lists all workspace memberships for a user without tenant session context.
 *
 * Same pattern as resolve_tour_tenant_for_public_flow (1777564000000): FORCE RLS on
 * user_tenants / tenants means reads are filtered by app.tenant_id; listing every
 * membership for workspace switching requires a SECURITY DEFINER entry point with
 * row_security disabled inside the function body only — not a separate DB role.
 */
export class ListUserWorkspacesForAuth1777567000000 implements MigrationInterface {
  name = "ListUserWorkspacesForAuth1777567000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION list_user_workspaces_for_auth(p_user_id uuid)
      RETURNS TABLE (
        tenant_id text,
        tenant_name text,
        role text
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $$
        SELECT ut.tenant_id::text AS tenant_id,
               t.name::text AS tenant_name,
               ut.role::text AS role
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
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          REVOKE EXECUTE ON FUNCTION list_user_workspaces_for_auth(uuid) FROM tour_ops;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS list_user_workspaces_for_auth(uuid)
    `);
  }
}
