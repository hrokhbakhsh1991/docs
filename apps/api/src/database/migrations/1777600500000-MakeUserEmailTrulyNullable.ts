import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phone/Telegram-first users no longer require synthetic `@local.invalid` emails.
 * Multiple active rows may have `email IS NULL`; uniqueness applies only when set.
 */
export class MakeUserEmailTrulyNullable1777600500000 implements MigrationInterface {
  name = "MakeUserEmailTrulyNullable1777600500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "email" = NULL
      WHERE "email" IS NOT NULL
        AND LOWER(TRIM("email")) LIKE '%@local.invalid'
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."uq_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_email"`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "email" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email_unique"
      ON "users" ("email")
      WHERE "email" IS NOT NULL AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_email_unique"`);

    await queryRunner.query(`
      UPDATE "users"
      SET "email" = CONCAT('migrated_', "id"::text, '@local.invalid')
      WHERE "email" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "email" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" ("email")
    `);
  }
}
