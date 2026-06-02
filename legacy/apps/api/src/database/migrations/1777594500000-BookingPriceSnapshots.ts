import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * **Append-only** store for immutable booking price facts (one row per snapshot).
 *
 * **Immutable:** no UPDATE/DELETE in application code for existing rows; **corrections** = insert a new snapshot
 * for the same `booking_id` (optionally linked by future metadata).
 *
 * Application wiring: {@link createPricingSnapshot} from registration save paths once a complete quote exists.
 * TODO: Reconciliation — compare ledger / payments vs `computed_total_minor` (+ policy tolerances).
 */
export class BookingPriceSnapshots1777594500000 implements MigrationInterface {
  name = "BookingPriceSnapshots1777594500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking_price_snapshots" (
        "snapshot_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "list_price_minor" bigint NOT NULL,
        "currency" character varying(3) NOT NULL,
        "pricing_rule_version" character varying(96) NOT NULL,
        "computed_total_minor" bigint NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_price_snapshots_snapshot_id" PRIMARY KEY ("snapshot_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_booking_price_snapshots_tenant_id"
      ON "booking_price_snapshots" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_booking_price_snapshots_booking_id"
      ON "booking_price_snapshots" ("booking_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_booking_price_snapshots_booking_created"
      ON "booking_price_snapshots" ("booking_id", "created_at")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_price_snapshots_booking'
        ) THEN
          ALTER TABLE "booking_price_snapshots"
            ADD CONSTRAINT "fk_booking_price_snapshots_booking"
            FOREIGN KEY ("booking_id") REFERENCES "registrations"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "booking_price_snapshots"
      DROP CONSTRAINT IF EXISTS "fk_booking_price_snapshots_booking"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_price_snapshots_booking_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_price_snapshots_booking_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_price_snapshots_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_price_snapshots"`);
  }
}
