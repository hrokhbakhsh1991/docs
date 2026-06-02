import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Denormalizes tenant_id onto orphan child tables and applies canonical RLS
 * (P0 from Gate 1 — tour_details / tour_prices bypassed tenant_isolation_policy).
 */
export class TourDetailsAndPricesTenantRls1777602000000 implements MigrationInterface {
  name = "TourDetailsAndPricesTenantRls1777602000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tour_details"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "tour_details" td
      SET "tenant_id" = t."tenant_id"
      FROM "tours" t
      WHERE t."id" = td."tour_id"
        AND td."tenant_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details"
      ALTER COLUMN "tenant_id" SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tour_details_tenant'
        ) THEN
          ALTER TABLE "tour_details"
          ADD CONSTRAINT "FK_tour_details_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_details_tenant_id_tour_id"
      ON "tour_details" ("tenant_id", "tour_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "tour_details" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'tour_details'
            AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy ON "tour_details"
          USING (tenant_id = current_setting('app.tenant_id')::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "tour_prices"
      ADD COLUMN IF NOT EXISTS "tenant_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "tour_prices" tp
      SET "tenant_id" = td."tenant_id"
      FROM "tour_departures" td
      WHERE td."id" = tp."tour_departure_id"
        AND tp."tenant_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_prices"
      ALTER COLUMN "tenant_id" SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tour_prices_tenant'
        ) THEN
          ALTER TABLE "tour_prices"
          ADD CONSTRAINT "FK_tour_prices_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_prices_tenant_id_departure_id"
      ON "tour_prices" ("tenant_id", "tour_departure_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "tour_prices" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_prices" FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'tour_prices'
            AND policyname = 'tenant_isolation_policy'
        ) THEN
          CREATE POLICY tenant_isolation_policy ON "tour_prices"
          USING (tenant_id = current_setting('app.tenant_id')::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP POLICY IF EXISTS tenant_isolation_policy ON "tour_prices"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_prices" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_prices" DISABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."idx_tour_prices_tenant_id_departure_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_prices" DROP CONSTRAINT IF EXISTS "FK_tour_prices_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_prices" DROP COLUMN IF EXISTS "tenant_id"
    `);

    await queryRunner.query(`
      DROP POLICY IF EXISTS tenant_isolation_policy ON "tour_details"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details" NO FORCE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details" DISABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."idx_tour_details_tenant_id_tour_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details" DROP CONSTRAINT IF EXISTS "FK_tour_details_tenant"
    `);
    await queryRunner.query(`
      ALTER TABLE "tour_details" DROP COLUMN IF EXISTS "tenant_id"
    `);
  }
}
