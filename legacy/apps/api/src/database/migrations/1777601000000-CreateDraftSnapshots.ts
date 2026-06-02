import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDraftSnapshots1777601000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "draft_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "draft_key" varchar(128) NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "version" int NOT NULL DEFAULT 1,
        "last_modified" bigint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_draft_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_draft_snapshots_scope" UNIQUE ("workspace_id", "user_id", "draft_key")
      );
      CREATE INDEX "idx_draft_snapshots_workspace_id" ON "draft_snapshots" ("workspace_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "draft_snapshots"`);
  }
}
