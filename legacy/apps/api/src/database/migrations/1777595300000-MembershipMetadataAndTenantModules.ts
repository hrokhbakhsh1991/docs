import type { MigrationInterface, QueryRunner } from "typeorm";

export class MembershipMetadataAndTenantModules1777595300000 implements MigrationInterface {
  name = "MembershipMetadataAndTenantModules1777595300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "membership_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "enabled_modules" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "enabled_modules"`);
    await queryRunner.query(
      `ALTER TABLE "user_tenants" DROP COLUMN IF EXISTS "membership_metadata"`,
    );
  }
}
