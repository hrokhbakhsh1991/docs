import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `snapshot_id` (nullable UUID FK → `booking_price_snapshots.snapshot_id`) to the
 * `registrations` table.
 *
 * **Why nullable?**
 * Existing registrations pre-date this column and cannot be backfilled retroactively without
 * a full pricing-engine re-run. The application layer enforces that ALL new registrations
 * created through the checkout flow must have this column set (see `RegistrationsService`).
 *
 * **Data invariant enforced at application layer:**
 * - New registrations: `snapshot_id IS NOT NULL` (enforced in `createAndStampSnapshot()`).
 * - Legacy registrations: `snapshot_id IS NULL` (no payment activity expected; guarded by
 *   `ensureBookingPriceSnapshotLockedAndEmit()`).
 */
export class RegistrationSnapshotId1777595200000 implements MigrationInterface {
  name = "RegistrationSnapshotId1777595200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Add nullable snapshot_id column.
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "snapshot_id" uuid NULL
    `);

    // FK to booking_price_snapshots — NO ACTION on delete to preserve audit trail.
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD CONSTRAINT "fk_registrations_snapshot_id"
        FOREIGN KEY ("snapshot_id")
        REFERENCES "booking_price_snapshots" ("snapshot_id")
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
        DEFERRABLE INITIALLY DEFERRED
    `);

    // Index for efficient lookup (e.g. "find all registrations linked to this snapshot").
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_registrations_snapshot_id"
        ON "registrations" ("snapshot_id")
        WHERE "snapshot_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_registrations_snapshot_id"`);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      DROP CONSTRAINT IF EXISTS "fk_registrations_snapshot_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      DROP COLUMN IF EXISTS "snapshot_id"
    `);
  }
}
