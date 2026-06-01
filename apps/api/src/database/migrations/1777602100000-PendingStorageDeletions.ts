import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Saga log for tour-clone MinIO copies: pending rows are cleaned by the scheduler
 * when older than the retention window; committed rows are removed after clone success.
 */
export class PendingStorageDeletions1777602100000 implements MigrationInterface {
  name = "PendingStorageDeletions1777602100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "pending_storage_deletion_status_enum" AS ENUM ('pending', 'committed')
    `);
    await queryRunner.query(`
      CREATE TABLE "pending_storage_deletions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "object_key" character varying(1024) NOT NULL,
        "clone_operation_id" uuid NOT NULL,
        "status" "pending_storage_deletion_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pending_storage_deletions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_pending_storage_deletions_status_created_at"
      ON "pending_storage_deletions" ("status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_pending_storage_deletions_clone_operation_id"
      ON "pending_storage_deletions" ("clone_operation_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_pending_storage_deletions_tenant_object_operation"
      ON "pending_storage_deletions" ("tenant_id", "object_key", "clone_operation_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_storage_deletions" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_storage_deletions" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_policy ON "pending_storage_deletions"
      USING (tenant_id = current_setting('app.tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_storage_deletions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pending_storage_deletion_status_enum"`);
  }
}
