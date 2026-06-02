import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Anchors bookings to `tour_departures` while keeping `tour_id` for backward compatibility.
 * Backfill: `COALESCE(tours.tour_departure_id, tours.id)` matches the 1:1 departure id model.
 */
export class RegistrationWaitlistTourDepartureId1777593100000 implements MigrationInterface {
  name = "RegistrationWaitlistTourDepartureId1777593100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "tour_departure_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "waitlist_items"
      ADD COLUMN IF NOT EXISTS "tour_departure_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "registrations" r
      SET "tour_departure_id" = COALESCE(t."tour_departure_id", t."id")
      FROM "tours" t
      WHERE t."id" = r."tour_id"
        AND r."tour_departure_id" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "waitlist_items" w
      SET "tour_departure_id" = COALESCE(t."tour_departure_id", t."id")
      FROM "tours" t
      WHERE t."id" = w."tour_id"
        AND w."tour_departure_id" IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_registrations_tour_departure_id'
        ) THEN
          ALTER TABLE "registrations"
            ADD CONSTRAINT "fk_registrations_tour_departure_id"
            FOREIGN KEY ("tour_departure_id")
            REFERENCES "tour_departures"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_waitlist_items_tour_departure_id'
        ) THEN
          ALTER TABLE "waitlist_items"
            ADD CONSTRAINT "fk_waitlist_items_tour_departure_id"
            FOREIGN KEY ("tour_departure_id")
            REFERENCES "tour_departures"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_registrations_tour_departure_id"
      ON "registrations" ("tour_departure_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_waitlist_items_tour_departure_id"
      ON "waitlist_items" ("tour_departure_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_waitlist_items_tour_departure_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_registrations_tour_departure_id"`);
    await queryRunner.query(
      `ALTER TABLE "waitlist_items" DROP CONSTRAINT IF EXISTS "fk_waitlist_items_tour_departure_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "registrations" DROP CONSTRAINT IF EXISTS "fk_registrations_tour_departure_id"`,
    );
    await queryRunner.query(`ALTER TABLE "waitlist_items" DROP COLUMN IF EXISTS "tour_departure_id"`);
    await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN IF EXISTS "tour_departure_id"`);
  }
}
