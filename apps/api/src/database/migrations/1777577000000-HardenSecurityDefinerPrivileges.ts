import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Final hardening pass for SECURITY DEFINER helpers used in bootstrap/auth flows.
 * Locks EXECUTE to `app_user` only (when present) and removes broad compatibility grants.
 */
export class HardenSecurityDefinerPrivileges1777577000000 implements MigrationInterface {
  name = "HardenSecurityDefinerPrivileges1777577000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) FROM PUBLIC
    `);
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) FROM CURRENT_USER
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          REVOKE EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) FROM tour_ops;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          GRANT EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) TO app_user;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) FROM PUBLIC
    `);
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) FROM CURRENT_USER
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          REVOKE EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) FROM tour_ops;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO app_user;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) FROM PUBLIC
    `);
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) FROM CURRENT_USER
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) FROM tour_ops;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) TO app_user;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) FROM app_user
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) TO CURRENT_USER
    `);
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) FROM app_user
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO CURRENT_USER
    `);
    await queryRunner.query(`
      REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) FROM app_user
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) TO CURRENT_USER
    `);
  }
}
