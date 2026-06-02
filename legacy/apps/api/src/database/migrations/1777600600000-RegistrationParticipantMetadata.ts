import { MigrationInterface, QueryRunner } from "typeorm";

export class RegistrationParticipantMetadata1777600600000 implements MigrationInterface {
  name = "RegistrationParticipantMetadata1777600600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "participant_metadata" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      DROP COLUMN IF EXISTS "participant_metadata"
    `);
  }
}
