import type { MigrationInterface, QueryRunner } from "typeorm";

const VALUES =
  "('general','mountain_outdoor','nature_trip','urban_event','cinema_event','cultural_tour')";

export class ToursFormProfileSnapshot1777593900000 implements MigrationInterface {
  name = "ToursFormProfileSnapshot1777593900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN IF NOT EXISTS "form_profile_snapshot" character varying(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD CONSTRAINT "CHK_tours_form_profile_snapshot"
      CHECK ("form_profile_snapshot" IS NULL OR "form_profile_snapshot" IN ${VALUES})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "CHK_tours_form_profile_snapshot"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "form_profile_snapshot"`);
  }
}
