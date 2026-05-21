import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Enterprise header-line pattern: journal batches anchor lines and payment/receipt pointers.
 */
export class LedgerJournalBatchesAndReferentialIntegrity1777600300000 implements MigrationInterface {
  name = "LedgerJournalBatchesAndReferentialIntegrity1777600300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_journal_batches" (
        "tenant_id" uuid NOT NULL,
        "journal_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_journal_batches" PRIMARY KEY ("tenant_id", "journal_id"),
        CONSTRAINT "FK_ledger_journal_batches_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      INSERT INTO "ledger_journal_batches" ("tenant_id", "journal_id", "created_at")
      SELECT "tenant_id", "journal_id", MIN("created_at")
      FROM "ledger_journal_lines"
      GROUP BY "tenant_id", "journal_id"
      ON CONFLICT ("tenant_id", "journal_id") DO NOTHING
    `);

    await queryRunner.query(`
      DELETE FROM "payments" p
      WHERE p."ledger_journal_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ledger_journal_batches" b
          WHERE b."tenant_id" = p."tenant_id"
            AND b."journal_id" = p."ledger_journal_id"
        )
    `);

    await queryRunner.query(`
      DELETE FROM "payment_receipts" r
      WHERE r."ledger_journal_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ledger_journal_batches" b
          WHERE b."tenant_id" = r."tenant_id"
            AND b."journal_id" = r."ledger_journal_id"
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "ledger_journal_lines"
      ADD CONSTRAINT "FK_ledger_journal_lines_batch"
        FOREIGN KEY ("tenant_id", "journal_id")
        REFERENCES "ledger_journal_batches" ("tenant_id", "journal_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD CONSTRAINT "FK_payments_ledger_journal_batch"
        FOREIGN KEY ("tenant_id", "ledger_journal_id")
        REFERENCES "ledger_journal_batches" ("tenant_id", "journal_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_receipts"
      ADD CONSTRAINT "FK_payment_receipts_ledger_journal_batch"
        FOREIGN KEY ("tenant_id", "ledger_journal_id")
        REFERENCES "ledger_journal_batches" ("tenant_id", "journal_id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_receipts"
      DROP CONSTRAINT IF EXISTS "FK_payment_receipts_ledger_journal_batch"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP CONSTRAINT IF EXISTS "FK_payments_ledger_journal_batch"
    `);
    await queryRunner.query(`
      ALTER TABLE "ledger_journal_lines"
      DROP CONSTRAINT IF EXISTS "FK_ledger_journal_lines_batch"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_journal_batches"`);
  }
}
