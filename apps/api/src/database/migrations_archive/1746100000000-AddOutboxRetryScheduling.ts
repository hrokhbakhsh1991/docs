import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxRetryScheduling1746100000000 implements MigrationInterface {
  name = "AddOutboxRetryScheduling1746100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      DROP COLUMN IF EXISTS "next_retry_at"
    `);
  }
}
