import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tenant isolation for draft_snapshots: workspace_id is the workspace tenant UUID.
 * Binds reads/writes to `app.tenant_id` (same as other tenant-scoped tables).
 */
export class DraftSnapshotsRls1777601500000 implements MigrationInterface {
  name = "DraftSnapshotsRls1777601500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'draft_snapshots'
            AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy ON "draft_snapshots"
            USING (workspace_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (workspace_id = current_setting('app.tenant_id')::uuid);
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS tenant_isolation_policy ON "draft_snapshots"
    `);
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots" DISABLE ROW LEVEL SECURITY
    `);
  }
}
