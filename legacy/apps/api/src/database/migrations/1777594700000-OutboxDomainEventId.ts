import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Optional stable domain event id for deduplicated enqueue (same txn retries / double-submit).
 */
export class OutboxDomainEventId1777594700000 implements MigrationInterface {
  name = "OutboxDomainEventId1777594700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "domain_event_id" character varying(128)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_outbox_events_tenant_domain_event_id"
      ON "outbox_events" ("tenant_id", "domain_event_id")
      WHERE "domain_event_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_outbox_events_tenant_domain_event_id"`);
    await queryRunner.query(`
      ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "domain_event_id"
    `);
  }
}
