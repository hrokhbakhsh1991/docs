import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Extends tenant isolation to tables scoped by `workspace_id` (workspace UUID = tenant UUID).
 * Uses the same session GUC as `tenant_id` tables: `current_setting('app.tenant_id')`.
 *
 * Skips tables that also have `tenant_id` (those are covered by StandardizeTenantScopedRlsPolicy).
 * Skips tables that already have `tenant_isolation_policy` (e.g. draft_snapshots).
 */
export class WorkspaceScopedRlsPolicy1777601600000 implements MigrationInterface {
  name = "WorkspaceScopedRlsPolicy1777601600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
      BEGIN
        FOR rec IN
          SELECT c.table_schema, c.table_name
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.column_name = 'workspace_id'
            AND NOT EXISTS (
              SELECT 1
              FROM information_schema.columns t
              WHERE t.table_schema = c.table_schema
                AND t.table_name = c.table_name
                AND t.column_name = 'tenant_id'
            )
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            rec.table_schema,
            rec.table_name
          );
          EXECUTE format(
            'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
            rec.table_schema,
            rec.table_name
          );

          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies p
            WHERE p.schemaname = rec.table_schema
              AND p.tablename = rec.table_name
              AND p.policyname = 'tenant_isolation_policy'
          ) THEN
            EXECUTE format(
              'CREATE POLICY tenant_isolation_policy ON %I.%I USING (workspace_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (workspace_id = current_setting(''app.tenant_id'')::uuid)',
              rec.table_schema,
              rec.table_name
            );
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Forward-only: workspace RLS standardization is not reverted automatically.
  }
}
