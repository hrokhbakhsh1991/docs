import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Persisted payment–finance reconciliation findings for operator triage (dashboards, acknowledgements, resolutions).
 */
export class ReconciliationFindings1777595100000 implements MigrationInterface {
  name = "ReconciliationFindings1777595100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "reconciliation_finding_status_enum" AS ENUM (
        'open',
        'acknowledged',
        'resolved',
        'dismissed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliation_findings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "reconciliation_job_id" uuid NOT NULL,
        "finding_uuid" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "kind" character varying(96) NOT NULL,
        "severity" character varying(16) NOT NULL,
        "message" text NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "triad_mismatch" jsonb,
        "status" "reconciliation_finding_status_enum" NOT NULL DEFAULT 'open',
        "resolution_note" text,
        "resolved_by_user_id" uuid,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliation_findings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reconciliation_findings_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_reconciliation_findings_job" FOREIGN KEY ("reconciliation_job_id") REFERENCES "reconciliation_jobs"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_reconciliation_findings_job_finding" UNIQUE ("reconciliation_job_id", "finding_uuid")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reconciliation_findings_tenant_status_created"
      ON "reconciliation_findings" ("tenant_id", "status", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reconciliation_findings_tenant_booking"
      ON "reconciliation_findings" ("tenant_id", "booking_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reconciliation_findings_tenant_booking"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_reconciliation_findings_tenant_status_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliation_findings"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "reconciliation_finding_status_enum"`);
  }
}
