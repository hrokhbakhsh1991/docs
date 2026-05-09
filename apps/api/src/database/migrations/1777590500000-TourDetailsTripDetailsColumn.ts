import type { MigrationInterface, QueryRunner } from "typeorm";

export class TourDetailsTripDetailsColumn1777590500000 implements MigrationInterface {
  name = "TourDetailsTripDetailsColumn1777590500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_details"
      ADD COLUMN IF NOT EXISTS "trip_details" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_details"
      DROP COLUMN IF EXISTS "trip_details"
    `);
  }
}
