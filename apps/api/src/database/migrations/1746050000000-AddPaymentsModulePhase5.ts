import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentsModulePhase51746050000000 implements MigrationInterface {
  name = "AddPaymentsModulePhase51746050000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "registration_status_enum" ADD VALUE IF NOT EXISTS 'AcceptedPaid'
    `);
    await queryRunner.query(`
      ALTER TYPE "registration_status_enum" ADD VALUE IF NOT EXISTS 'Refunded'
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum'
        ) THEN
          CREATE TYPE "payment_status_enum" AS ENUM (
            'Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'
          );
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "registration_id" uuid NOT NULL,
        "amount" numeric NOT NULL,
        "currency" character varying(8) NOT NULL,
        "provider" character varying(64) NOT NULL,
        "provider_payment_id" character varying(128),
        "status" "payment_status_enum" NOT NULL DEFAULT 'Pending',
        "paid_at" TIMESTAMPTZ,
        "failed_at" TIMESTAMPTZ,
        "refunded_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_registration_id" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payments_tenant_id" ON "payments" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payments_registration_id" ON "payments" ("registration_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_payments_status" ON "payments" ("status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_payments_provider_payment_id" ON "payments" ("provider_payment_id")
      WHERE "provider_payment_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_payments_registration_pending"
      ON "payments" ("registration_id")
      WHERE "status" = 'Pending'
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_isolation_policy"
      ON "payments"
      USING (tenant_id = current_setting('app.tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS "tenant_isolation_policy" ON "payments"
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" DISABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_payments_registration_pending"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_payments_provider_payment_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_payments_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_payments_registration_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_payments_tenant_id"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "payments"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "payment_status_enum"
    `);
  }
}
