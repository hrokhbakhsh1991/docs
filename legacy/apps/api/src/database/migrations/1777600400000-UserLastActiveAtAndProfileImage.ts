import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserLastActiveAtAndProfileImage1777600400000 implements MigrationInterface {
  name = "UserLastActiveAtAndProfileImage1777600400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "profile_image_url" character varying(2048) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_last_active_at"
        ON "users" ("last_active_at")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_last_active_at"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "profile_image_url"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "last_active_at"
    `);
  }
}
