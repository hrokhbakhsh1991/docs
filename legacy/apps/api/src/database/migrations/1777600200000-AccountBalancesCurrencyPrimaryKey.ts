import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Expand account_balances PK to (tenant_id, account, currency) so mixed-currency
 * postings cannot poison a single balance_minor bucket.
 */
export class AccountBalancesCurrencyPrimaryKey1777600200000 implements MigrationInterface {
  name = "AccountBalancesCurrencyPrimaryKey1777600200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_account_balances_rebuild" ON COMMIT DROP AS
      SELECT
        l.tenant_id,
        l.account,
        l.currency,
        SUM(CASE WHEN l.side = 'credit' THEN l.amount_minor ELSE -l.amount_minor END)::bigint AS balance_minor,
        MAX(l.created_at) AS updated_at
      FROM ledger_journal_lines l
      GROUP BY l.tenant_id, l.account, l.currency
    `);

    await queryRunner.query(`DELETE FROM account_balances`);

    await queryRunner.query(`
      INSERT INTO account_balances (tenant_id, account, balance_minor, currency, row_version, updated_at)
      SELECT tenant_id, account, balance_minor, currency, 1, updated_at
      FROM "_account_balances_rebuild"
    `);

    await queryRunner.query(`
      ALTER TABLE account_balances DROP CONSTRAINT IF EXISTS "PK_account_balances"
    `);

    await queryRunner.query(`
      ALTER TABLE account_balances ADD CONSTRAINT "PK_account_balances"
        PRIMARY KEY ("tenant_id", "account", "currency")
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_account_balances_tenant_account"`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_account_balances_tenant_account_currency"
        ON "account_balances" ("tenant_id", "account", "currency")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_account_balances_tenant_account_currency"`);
    await queryRunner.query(`
      ALTER TABLE account_balances DROP CONSTRAINT IF EXISTS "PK_account_balances"
    `);
    await queryRunner.query(`
      ALTER TABLE account_balances ADD CONSTRAINT "PK_account_balances"
        PRIMARY KEY ("tenant_id", "account")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_account_balances_tenant_account"
        ON "account_balances" ("tenant_id", "account")
    `);
  }
}
