import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * White-label ingress: map full FQDN / browser Origin to tenant UUID.
 * Host resolution and CORS both consult this registry (with Redis memoization at runtime).
 */
export class TenantCustomDomains1777601800000 implements MigrationInterface {
  name = "TenantCustomDomains1777601800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_custom_domains" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "hostname" character varying(253) NOT NULL,
        "web_origin" character varying(512) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_custom_domains" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_custom_domains_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_custom_domains_hostname_active_lower"
      ON "tenant_custom_domains" (lower("hostname"))
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_custom_domains_web_origin_active_lower"
      ON "tenant_custom_domains" (lower("web_origin"))
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_custom_domains_tenant_id"
      ON "tenant_custom_domains" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_tenant_custom_domains_tenant_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_tenant_custom_domains_web_origin_active_lower"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_tenant_custom_domains_hostname_active_lower"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_custom_domains"`);
  }
}
