import { MigrationInterface, QueryRunner } from "typeorm";

const TENANT_SCOPED_TABLES = [
  "workspace_invites",
  "user_role_audit",
  "tenant_usage_daily",
  "tenant_plan_limits"
] as const;

export class TenantScopedTablesRlsCoverage1777576500000
  implements MigrationInterface
{
  name = "TenantScopedTablesRlsCoverage1777576500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TENANT_SCOPED_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = '${table}'
              AND policyname = 'tenant_isolation_select'
          ) THEN
            CREATE POLICY tenant_isolation_select
            ON "${table}"
            FOR SELECT
            USING (tenant_id = current_setting('app.tenant_id')::uuid);
          END IF;
        END
        $$;
      `);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = '${table}'
              AND policyname = 'tenant_isolation_modify'
          ) THEN
            CREATE POLICY tenant_isolation_modify
            ON "${table}"
            FOR ALL
            USING (tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TENANT_SCOPED_TABLES) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = '${table}'
              AND policyname = 'tenant_isolation_modify'
          ) THEN
            DROP POLICY tenant_isolation_modify ON "${table}";
          END IF;
        END
        $$;
      `);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = '${table}'
              AND policyname = 'tenant_isolation_select'
          ) THEN
            DROP POLICY tenant_isolation_select ON "${table}";
          END IF;
        END
        $$;
      `);
    }
  }
}
