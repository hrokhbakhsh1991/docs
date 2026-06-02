import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-tenant PSP credentials (Stripe, Zibal, …). Runtime resolves via
 * {@link PaymentGatewayFactory.forTenant} with env fallback when no active row exists.
 */
export class TenantPaymentConfigs1777601900000 implements MigrationInterface {
  name = "TenantPaymentConfigs1777601900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_payment_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "provider" character varying(32) NOT NULL,
        "api_key" character varying(512),
        "merchant_id" character varying(128),
        "callback_url" character varying(512),
        "webhook_signing_secret" character varying(512),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_payment_configs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_payment_configs_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_payment_configs_tenant_provider_active"
      ON "tenant_payment_configs" ("tenant_id", lower("provider"))
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tenant_payment_configs_tenant_id"
      ON "tenant_payment_configs" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_tenant_payment_configs_tenant_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_tenant_payment_configs_tenant_provider_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_payment_configs"`);
  }
}
