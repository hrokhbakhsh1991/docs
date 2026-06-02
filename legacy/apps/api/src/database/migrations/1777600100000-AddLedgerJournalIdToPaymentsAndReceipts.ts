import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddLedgerJournalIdToPaymentsAndReceipts1777600100000 implements MigrationInterface {
  name = "AddLedgerJournalIdToPaymentsAndReceipts1777600100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "ledger_journal_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_receipts"
      ADD COLUMN IF NOT EXISTS "ledger_journal_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payments_ledger_journal_id"
        ON "payments" ("ledger_journal_id")
        WHERE "ledger_journal_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_receipts_ledger_journal_id"
        ON "payment_receipts" ("ledger_journal_id")
        WHERE "ledger_journal_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_receipts_ledger_journal_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_ledger_journal_id"`);
    await queryRunner.query(`ALTER TABLE "payment_receipts" DROP COLUMN IF EXISTS "ledger_journal_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "ledger_journal_id"`);
  }
}
