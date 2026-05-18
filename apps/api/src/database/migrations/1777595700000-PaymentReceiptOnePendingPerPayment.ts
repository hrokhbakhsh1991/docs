import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pilot: at most one Pending receipt per payment (map-phase D10.1).
 */
export class PaymentReceiptOnePendingPerPayment1777595700000 implements MigrationInterface {
  name = "PaymentReceiptOnePendingPerPayment1777595700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payment_receipts_payment_pending"
      ON "payment_receipts" ("payment_id")
      WHERE "status" = 'Pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_payment_receipts_payment_pending"`);
  }
}
