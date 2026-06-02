import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Optimistic concurrency for registration ("booking") rows.
 * `users` already uses `profile_row_version` ({@link UserProfileRowVersion1777593500000}); this migration targets `registrations` only.
 */
export class RegistrationRowVersion1777594100000 implements MigrationInterface {
  name = "RegistrationRowVersion1777594100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "row_version" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "registrations" DROP COLUMN IF EXISTS "row_version"`);
  }
}
