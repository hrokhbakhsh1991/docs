import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMembershipLifecycleToUserTenants1777585000000
  implements MigrationInterface
{
  name = "AddMembershipLifecycleToUserTenants1777585000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "invited_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMP WITH TIME ZONE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      DROP COLUMN IF EXISTS "suspended_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      DROP COLUMN IF EXISTS "joined_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      DROP COLUMN IF EXISTS "invited_at"
    `);
  }
}
