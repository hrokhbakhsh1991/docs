import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkspaceAuditLogs1777595900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "entity_type" varchar(64) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" varchar(128) NOT NULL,
        "meta" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_audit_logs" PRIMARY KEY ("id")
      );
      CREATE INDEX "idx_workspace_audit_logs_workspace_id" ON "workspace_audit_logs" ("workspace_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_audit_logs"`);
  }
}
