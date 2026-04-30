import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTelegramUserIdToUsers1745907000000
  implements MigrationInterface
{
  name = "AddTelegramUserIdToUsers1745907000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "telegram_user_id" character varying(32)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_users_telegram_user_id" ON "users" ("telegram_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_users_telegram_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "telegram_user_id"
    `);
  }
}
