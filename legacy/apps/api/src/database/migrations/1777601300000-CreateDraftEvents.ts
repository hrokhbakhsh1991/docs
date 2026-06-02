import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDraftEvents1777601300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "draft_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "draft_key" varchar(128) NOT NULL,
        "event_type" varchar(64) NOT NULL,
        "trace_id" varchar(128),
        "base_version" int,
        "next_version" int,
        "payload_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_draft_events" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "idx_draft_events_workspace_id" ON "draft_events" ("workspace_id");
      CREATE INDEX IF NOT EXISTS "idx_draft_events_scope" ON "draft_events" ("workspace_id", "user_id", "draft_key");
      CREATE INDEX IF NOT EXISTS "idx_draft_events_created_at" ON "draft_events" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "draft_events"`);
  }
}
