import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableTenantRls1745870400000 implements MigrationInterface {
  name = "EnableTenantRls1745870400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE row_item RECORD;
      BEGIN
        FOR row_item IN
          SELECT table_schema, table_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name = 'tenant_id'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            row_item.table_schema,
            row_item.table_name
          );

          EXECUTE format(
            'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
            row_item.table_schema,
            row_item.table_name
          );

          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = row_item.table_schema
              AND tablename = row_item.table_name
              AND policyname = 'tenant_isolation_policy'
          ) THEN
            EXECUTE format(
              'CREATE POLICY tenant_isolation_policy ON %I.%I USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)',
              row_item.table_schema,
              row_item.table_name
            );
          END IF;
        END LOOP;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE row_item RECORD;
      BEGIN
        FOR row_item IN
          SELECT table_schema, table_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name = 'tenant_id'
        LOOP
          EXECUTE format(
            'DROP POLICY IF EXISTS tenant_isolation_policy ON %I.%I',
            row_item.table_schema,
            row_item.table_name
          );

          EXECUTE format(
            'ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY',
            row_item.table_schema,
            row_item.table_name
          );

          EXECUTE format(
            'ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY',
            row_item.table_schema,
            row_item.table_name
          );
        END LOOP;
      END
      $$;
    `);
  }
}
