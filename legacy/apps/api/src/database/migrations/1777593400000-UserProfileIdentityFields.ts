import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserProfileIdentityFields1777593400000 implements MigrationInterface {
  name = "UserProfileIdentityFields1777593400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "national_id" character varying(10) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "gender" character varying(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "birth_date" date NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "chk_users_profile_gender"
      CHECK (
        "gender" IS NULL
        OR "gender" IN ('female', 'male', 'non_binary', 'prefer_not_to_say')
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_national_id_active"
      ON "users" ("national_id")
      WHERE "national_id" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_national_id_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "chk_users_profile_gender"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "birth_date"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gender"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "national_id"`);
  }
}
