import type { MigrationInterface, QueryRunner } from "typeorm";

export class LedgerJournalLinesAndAccountBalances1777600000000 implements MigrationInterface {
  name = "LedgerJournalLinesAndAccountBalances1777600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ledger_posting_side_enum" AS ENUM ('debit', 'credit');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ledger_journal_lines" (
        "id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "journal_id" uuid NOT NULL,
        "account" character varying(128) NOT NULL,
        "side" "ledger_posting_side_enum" NOT NULL,
        "amount_minor" bigint NOT NULL,
        "currency" character varying(8) NOT NULL,
        "idempotency_key" character varying(256) NOT NULL,
        "correlation_id" character varying(256) NOT NULL,
        "reverses_line_id" uuid,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_ledger_journal_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_journal_lines_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "CHK_ledger_journal_lines_amount_positive" CHECK ("amount_minor" > 0),
        CONSTRAINT "UQ_ledger_journal_lines_tenant_idempotency"
          UNIQUE ("tenant_id", "idempotency_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ledger_journal_lines_tenant_journal"
        ON "ledger_journal_lines" ("tenant_id", "journal_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ledger_journal_lines_tenant_account_created"
        ON "ledger_journal_lines" ("tenant_id", "account", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ledger_journal_lines_reverses_line"
        ON "ledger_journal_lines" ("reverses_line_id")
        WHERE "reverses_line_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ledger_journal_lines_deny_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'ledger_journal_lines is append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_ledger_journal_lines_no_update"
        BEFORE UPDATE ON "ledger_journal_lines"
        FOR EACH ROW EXECUTE FUNCTION ledger_journal_lines_deny_mutation();
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_ledger_journal_lines_no_delete"
        BEFORE DELETE ON "ledger_journal_lines"
        FOR EACH ROW EXECUTE FUNCTION ledger_journal_lines_deny_mutation();
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_balances" (
        "tenant_id" uuid NOT NULL,
        "account" character varying(128) NOT NULL,
        "balance_minor" bigint NOT NULL DEFAULT 0,
        "currency" character varying(8) NOT NULL DEFAULT '',
        "row_version" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("tenant_id", "account"),
        CONSTRAINT "FK_account_balances_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_account_balances_tenant_account"
        ON "account_balances" ("tenant_id", "account")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_ledger_journal_lines_no_delete" ON "ledger_journal_lines"`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "trg_ledger_journal_lines_no_update" ON "ledger_journal_lines"`
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS ledger_journal_lines_deny_mutation()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_balances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_journal_lines"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_posting_side_enum"`);
  }
}
