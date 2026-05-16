import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Durable PSP gateway idempotency (cross-replica, crash-safe via PostgreSQL).
 * Digest is SHA-256 hex over tenant + operation + client idempotency key (see {@link paymentGatewayIdempotencyCompositeKey}).
 */
export class PaymentGatewayIdempotency1777594900000 implements MigrationInterface {
  name = "PaymentGatewayIdempotency1777594900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_gateway_idempotency" (
        "digest" character varying(64) NOT NULL,
        "tenant_id" uuid NOT NULL,
        "operation" character varying(191) NOT NULL,
        "idempotency_key" character varying(255) NOT NULL,
        "status" character varying(16) NOT NULL,
        "result_payload" jsonb,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_gateway_idempotency" PRIMARY KEY ("digest"),
        CONSTRAINT "CHK_payment_gateway_idempotency_status" CHECK ("status" IN ('pending', 'completed'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_gateway_idempotency_expires"
      ON "payment_gateway_idempotency" ("expires_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_gateway_idempotency_tenant"
      ON "payment_gateway_idempotency" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_gateway_idempotency_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payment_gateway_idempotency_expires"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_gateway_idempotency"`);
  }
}
