import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenantOperatingCurrencyCodeColumn1777600500000 implements MigrationInterface {
  name = "AddTenantOperatingCurrencyCodeColumn1777600500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "operating_currency_code" character varying(10) NULL
    `);
    await queryRunner.query(`
      UPDATE "tenants"
      SET "operating_currency_code" = 'IRR'
      WHERE "operating_currency_code" IS NULL
         OR TRIM("operating_currency_code") = ''
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ALTER COLUMN "operating_currency_code" SET DEFAULT 'IRR'
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ALTER COLUMN "operating_currency_code" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "operating_currency_code"
    `);
  }
}
