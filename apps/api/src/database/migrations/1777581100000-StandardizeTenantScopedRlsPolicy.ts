import { MigrationInterface, QueryRunner } from "typeorm";

export class StandardizeTenantScopedRlsPolicy1777581100000
  implements MigrationInterface
{
  name = "StandardizeTenantScopedRlsPolicy1777581100000";

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
            AND c.column_name = 'tenant_id'
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
              'CREATE POLICY tenant_isolation_policy ON %I.%I USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)',
              rec.table_schema,
              rec.table_name
            );
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: policy standardization is intentionally forward-only.
  }
}
