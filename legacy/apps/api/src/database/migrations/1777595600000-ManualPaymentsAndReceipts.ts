import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Manual payment method on `payments` + `payment_receipts` for finance receipt upload flow.
 * RLS uses `tenant_isolation_policy` (same shape as StandardizeTenantScopedRlsPolicy).
 */
export class ManualPaymentsAndReceipts1777595600000 implements MigrationInterface {
  name = "ManualPaymentsAndReceipts1777595600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
          CREATE TYPE "payment_method_enum" AS ENUM ('Online', 'Manual');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "method" "payment_method_enum" NOT NULL DEFAULT 'Online'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payments_method" ON "payments" ("method")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status_enum') THEN
          CREATE TYPE "receipt_status_enum" AS ENUM ('Pending', 'Approved', 'Rejected');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "payment_id" uuid NOT NULL,
        "file_key" character varying(1024) NOT NULL,
        "status" "receipt_status_enum" NOT NULL DEFAULT 'Pending',
        "note" text,
        "reviewed_by_user_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "review_note" text,
        CONSTRAINT "PK_payment_receipts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_receipts_tenant_id"
      ON "payment_receipts" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_receipts_payment_id"
      ON "payment_receipts" ("payment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payment_receipts_status"
      ON "payment_receipts" ("status")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payment_receipts_payment') THEN
          ALTER TABLE "payment_receipts"
            ADD CONSTRAINT "FK_payment_receipts_payment"
            FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payment_receipts_reviewed_by') THEN
          ALTER TABLE "payment_receipts"
            ADD CONSTRAINT "FK_payment_receipts_reviewed_by"
            FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_receipts_tenant') THEN
          ALTER TABLE "payment_receipts"
            ADD CONSTRAINT "fk_payment_receipts_tenant"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE "payment_receipts" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "payment_receipts" FORCE ROW LEVEL SECURITY`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'payment_receipts'
            AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy ON "payment_receipts"
            USING (tenant_id = current_setting('app.tenant_id')::uuid)
            WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS tenant_isolation_policy ON "payment_receipts"`
    );
    await queryRunner.query(`ALTER TABLE "payment_receipts" NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "payment_receipts" DISABLE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `ALTER TABLE "payment_receipts" DROP CONSTRAINT IF EXISTS "fk_payment_receipts_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_receipts" DROP CONSTRAINT IF EXISTS "FK_payment_receipts_reviewed_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_receipts" DROP CONSTRAINT IF EXISTS "FK_payment_receipts_payment"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_receipts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_payments_method"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "method"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "receipt_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_method_enum"`);
  }
}
