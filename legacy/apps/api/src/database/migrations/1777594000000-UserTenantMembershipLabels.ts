import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserTenantMembershipLabels1777594000000 implements MigrationInterface {
  name = "UserTenantMembershipLabels1777594000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "labels" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_tenants" DROP COLUMN IF EXISTS "labels"`);
  }
}
