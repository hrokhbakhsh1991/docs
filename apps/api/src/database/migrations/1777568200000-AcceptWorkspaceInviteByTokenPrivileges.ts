import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tightens EXECUTE on accept_workspace_invite_by_token: PUBLIC and other roles must not
 * retain access; only app_user (runtime DB role) is granted EXECUTE.
 */
export class AcceptWorkspaceInviteByTokenPrivileges1777568200000 implements MigrationInterface {
  name = "AcceptWorkspaceInviteByTokenPrivileges1777568200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
          REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) FROM app_user;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) TO PUBLIC
    `);

    await queryRunner.query(`
      GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) TO CURRENT_USER
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tour_ops') THEN
          GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) TO tour_ops;
        END IF;
      END $$
    `);
  }
}
