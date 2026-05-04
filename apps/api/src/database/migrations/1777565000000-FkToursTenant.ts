import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Enforces referential integrity for tours.tenant_id.
 *
 * Prerequisite: every tours.tenant_id must reference tenants.id (run consistency checks first).
 *
 * Note: ON DELETE CASCADE removes tour rows when a tenant row is hard-deleted. Tours cannot be
 * removed while registrations or waitlist_items still reference them (NO ACTION on those FKs),
 * so tenant hard-delete may fail until dependents are handled — same as deleting tours directly.
 */
export class FkToursTenant1777565000000 implements MigrationInterface {
  name = "FkToursTenant1777565000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_tours_tenant'
        ) THEN
          ALTER TABLE "tours"
            ADD CONSTRAINT "fk_tours_tenant"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$
    `);
  }

  /**
   * Rollback: drop fk_tours_tenant from tours.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
      DROP CONSTRAINT IF EXISTS "fk_tours_tenant"
    `);
  }
}
