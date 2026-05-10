import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * After backfill, every registration / waitlist row must reference `tour_departures`.
 */
export class TourDepartureIdNotNull1777593300000 implements MigrationInterface {
  name = "TourDepartureIdNotNull1777593300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      ALTER TABLE "registrations"
      ALTER COLUMN "tour_departure_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "waitlist_items"
      ALTER COLUMN "tour_departure_id" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "waitlist_items"
      ALTER COLUMN "tour_departure_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ALTER COLUMN "tour_departure_id" DROP NOT NULL
    `);
  }
}
