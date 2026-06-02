import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Aligns EXECUTE on SECURITY DEFINER helpers with
 * `1777568200000-AcceptWorkspaceInviteByTokenPrivileges`:
 * revoke PUBLIC / CURRENT_USER / tour_ops; grant only `app_user` when present.
 *
 * Runtime must connect as `app_user` (or a role explicitly granted EXECUTE) —
 * same expectation as `accept_workspace_invite_by_token` after 1777568200000.
 */
export class SecurityDefinerExecutePrivilegesAlign1777575200000 implements MigrationInterface {
  name = "SecurityDefinerExecutePrivilegesAlign1777575200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          REVOKE EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) FROM app_user;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO CURRENT_USER
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.list_user_workspaces_for_auth(uuid) TO tour_ops;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          REVOKE EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) FROM app_user;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) TO CURRENT_USER
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.resolve_tour_tenant_for_public_flow(uuid) TO tour_ops;
        END IF;
      END $$
    `);
  }
}
