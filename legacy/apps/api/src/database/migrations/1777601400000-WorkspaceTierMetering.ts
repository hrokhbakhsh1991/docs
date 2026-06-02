import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkspaceTierMetering1777601400000 implements MigrationInterface {
  name = "WorkspaceTierMetering1777601400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_plan_limits"
        ADD COLUMN IF NOT EXISTS "plan_tier" text,
        ADD COLUMN IF NOT EXISTS "max_active_tours" bigint,
        ADD COLUMN IF NOT EXISTS "max_users" bigint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant_plan_limits"
        DROP COLUMN IF EXISTS "max_users",
        DROP COLUMN IF EXISTS "max_active_tours",
        DROP COLUMN IF EXISTS "plan_tier"
    `);
  }
}
