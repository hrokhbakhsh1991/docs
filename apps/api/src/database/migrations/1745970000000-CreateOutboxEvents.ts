import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOutboxEvents1745970000000 implements MigrationInterface {
  name = "CreateOutboxEvents1745970000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "outbox_event_status_enum" AS ENUM ('PENDING', 'DELIVERED', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "aggregate_type" character varying(64) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_type" character varying(128) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "outbox_event_status_enum" NOT NULL DEFAULT 'PENDING',
        "retry_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_outbox_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_status_created_at"
      ON "outbox_events" ("status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_aggregate"
      ON "outbox_events" ("aggregate_type", "aggregate_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_events_aggregate"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_events_status_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "outbox_event_status_enum"`);
  }
}
