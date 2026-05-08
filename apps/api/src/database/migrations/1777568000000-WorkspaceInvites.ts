import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceInvites1777568000000 implements MigrationInterface {
  name = "WorkspaceInvites1777568000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "email" character varying(320) NOT NULL,
        "role" character varying(64) NOT NULL,
        "token" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_invites_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_invites_tenant_id"
      ON "workspace_invites" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_invites_email"
      ON "workspace_invites" ("email")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_invites_expires_at"
      ON "workspace_invites" ("expires_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_workspace_invites_token"
      ON "workspace_invites" ("token")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_workspace_invites_tenant_email"
      ON "workspace_invites" ("tenant_id", "email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_invites_tenant_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."uq_workspace_invites_token"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_invites_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_invites_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_workspace_invites_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_invites"`);
  }
}
