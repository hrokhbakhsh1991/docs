import { MigrationInterface, QueryRunner } from "typeorm";

export class TenantUsageMetering1777576400000 implements MigrationInterface {
  name = "TenantUsageMetering1777576400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_usage_daily" (
        "tenant_id" uuid NOT NULL,
        "date" date NOT NULL,
        "api_requests" bigint NOT NULL DEFAULT 0,
        "background_jobs" bigint NOT NULL DEFAULT 0,
        "storage_bytes" bigint NOT NULL DEFAULT 0,
        "login_attempts" bigint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_tenant_usage_daily" PRIMARY KEY ("tenant_id", "date"),
        CONSTRAINT "FK_tenant_usage_daily_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_plan_limits" (
        "tenant_id" uuid NOT NULL,
        "api_requests_per_day" bigint,
        "jobs_per_day" bigint,
        "storage_limit" bigint,
        CONSTRAINT "PK_tenant_plan_limits" PRIMARY KEY ("tenant_id"),
        CONSTRAINT "FK_tenant_plan_limits_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_plan_limits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_usage_daily"`);
  }
}

