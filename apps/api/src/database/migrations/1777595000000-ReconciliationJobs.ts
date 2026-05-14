import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Persists PSP / bank / payment–finance reconciliation job rows for ops audit and alerting.
 */
export class ReconciliationJobs1777595000000 implements MigrationInterface {
  name = "ReconciliationJobs1777595000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "reconciliation_job_kind_enum" AS ENUM (
        'payment_finance',
        'psp_settlement',
        'bank_feed'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "reconciliation_job_status_enum" AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'completed_with_mismatches',
        'failed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliation_jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "job_kind" "reconciliation_job_kind_enum" NOT NULL,
        "status" "reconciliation_job_status_enum" NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "booking_id" uuid,
        "mismatch_count" integer NOT NULL DEFAULT 0,
        "critical_count" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "error_message" text,
        CONSTRAINT "PK_reconciliation_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reconciliation_jobs_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reconciliation_jobs_tenant_started"
      ON "reconciliation_jobs" ("tenant_id", "started_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reconciliation_jobs_tenant_status"
      ON "reconciliation_jobs" ("tenant_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reconciliation_jobs_tenant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reconciliation_jobs_tenant_started"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliation_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_job_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_job_kind_enum"`);
  }
}
