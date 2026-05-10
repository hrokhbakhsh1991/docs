import type { MigrationInterface, QueryRunner } from "typeorm";

/** Optimistic concurrency for `PATCH /me` (paired with `{@VersionColumn}` on `users.profile_row_version`). */
export class UserProfileRowVersion1777593500000 implements MigrationInterface {
  name = "UserProfileRowVersion1777593500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "profile_row_version" integer NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profile_row_version"`);
  }
}
