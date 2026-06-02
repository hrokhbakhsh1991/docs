import type { MigrationInterface, QueryRunner } from "typeorm";

export class UsersNotificationsEnabled1777591200000 implements MigrationInterface {
  name = "UsersNotificationsEnabled1777591200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "notifications_enabled" boolean NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "notifications_enabled"
    `);
  }
}
