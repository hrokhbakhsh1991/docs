import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tenant-aware transactional outbox: every row carries tenant_id for worker isolation.
 *
 * Note: `outbox_events` does **not** use PostgreSQL RLS (global polling SELECT/FOR UPDATE
 * across tenants). Tenant isolation for downstream DB reads relies on the worker calling
 * `set_config('app.tenant_id', tenant_id, true)` before dispatch — see OutboxProcessor.
 */
export class OutboxTenantId1777576100000 implements MigrationInterface {
  name = "OutboxTenantId1777576100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "outbox_events" SET tenant_id = (payload->>'tenantId')::uuid
      WHERE tenant_id IS NULL AND payload ? 'tenantId'
    `);

    await queryRunner.query(`
      UPDATE "outbox_events" SET tenant_id = (payload->>'tenant_id')::uuid
      WHERE tenant_id IS NULL AND payload ? 'tenant_id'
    `);

    await queryRunner.query(`
      UPDATE "outbox_events" o
      SET tenant_id = r.tenant_id
      FROM registrations r
      WHERE o.tenant_id IS NULL
        AND o.aggregate_type = 'Registration'
        AND r.id = o."aggregate_id"
    `);

    await queryRunner.query(`
      UPDATE "outbox_events" o
      SET tenant_id = r.tenant_id
      FROM registrations r
      WHERE o.tenant_id IS NULL
        AND o.aggregate_type = 'Payment'
        AND r.id = (o.payload->>'registrationId')::uuid
    `);

    await queryRunner.query(`
      UPDATE "outbox_events" o
      SET tenant_id = w.tenant_id
      FROM waitlist_items w
      WHERE o.tenant_id IS NULL
        AND o.aggregate_type = 'WaitlistItem'
        AND w.id = o."aggregate_id"
    `);

    await queryRunner.query(`
      UPDATE "outbox_events" o
      SET tenant_id = t.tenant_id
      FROM tours t
      WHERE o.tenant_id IS NULL
        AND o.aggregate_type = 'Tour'
        AND t.id = o."aggregate_id"
    `);

    await queryRunner.query(`
      DO $$
      DECLARE orphan_count bigint;
      BEGIN
        SELECT COUNT(*) INTO orphan_count FROM outbox_events WHERE tenant_id IS NULL;
        IF orphan_count > 0 THEN
          RAISE EXCEPTION 'OutboxTenantId1777576100000: % orphaned row(s) without tenant_id', orphan_count;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "outbox_events"
      ALTER COLUMN "tenant_id" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_outbox_events_tenant'
        ) THEN
          ALTER TABLE "outbox_events"
          ADD CONSTRAINT "fk_outbox_events_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_events_tenant_created_at"
      ON "outbox_events" ("tenant_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."idx_outbox_events_tenant_created_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "outbox_events" DROP CONSTRAINT IF EXISTS "fk_outbox_events_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "tenant_id"
    `);
  }
}
