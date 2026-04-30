import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandRegistrationPaymentLifecycle1745965500000
  implements MigrationInterface
{
  name = "ExpandRegistrationPaymentLifecycle1745965500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "registration_payment_status_enum" ADD VALUE IF NOT EXISTS 'Refunded'
    `);
    await queryRunner.query(`
      ALTER TYPE "registration_payment_status_enum" ADD VALUE IF NOT EXISTS 'Failed'
    `);
    await queryRunner.query(`
      ALTER TABLE "registrations"
      ADD COLUMN IF NOT EXISTS "payment_metadata" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "registrations"
      DROP COLUMN IF EXISTS "payment_metadata"
    `);
  }
}
