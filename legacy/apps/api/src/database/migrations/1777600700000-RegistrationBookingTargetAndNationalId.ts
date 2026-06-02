import { MigrationInterface, QueryRunner } from "typeorm";

export class RegistrationBookingTargetAndNationalId1777600700000 implements MigrationInterface {
  name = "RegistrationBookingTargetAndNationalId1777600700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "booking_target" character varying(16) NOT NULL DEFAULT 'self'
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "participant_national_id" character varying(10) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      DROP COLUMN IF EXISTS "participant_national_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      DROP COLUMN IF EXISTS "booking_target"
    `);
  }
}
