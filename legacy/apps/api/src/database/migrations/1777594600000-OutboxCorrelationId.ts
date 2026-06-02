import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `correlation_id` for cross-service tracing of outbox rows (HTTP `x-request-id` / ALS).
 */
export class OutboxCorrelationId1777594600000 implements MigrationInterface {
  name = "OutboxCorrelationId1777594600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "correlation_id" character varying(128)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_events_correlation_id"
      ON "outbox_events" ("correlation_id")
      WHERE "correlation_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outbox_events_correlation_id"`);
    await queryRunner.query(`
      ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "correlation_id"
    `);
  }
}
