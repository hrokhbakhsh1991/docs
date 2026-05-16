import type { MigrationInterface, QueryRunner } from "typeorm";

export class RegistrationPricingEngineSnapshot1777594200000 implements MigrationInterface {
  name = "RegistrationPricingEngineSnapshot1777594200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "quoted_total_minor" bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "quoted_pricing_version" character varying(96)
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "quoted_line_items_json" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations" DROP COLUMN IF EXISTS "quoted_line_items_json"
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations" DROP COLUMN IF EXISTS "quoted_pricing_version"
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations" DROP COLUMN IF EXISTS "quoted_total_minor"
    `);
  }
}
