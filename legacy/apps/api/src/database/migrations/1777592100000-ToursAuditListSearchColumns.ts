import type { MigrationInterface, QueryRunner } from "typeorm";

export class ToursAuditListSearchColumns1777592100000 implements MigrationInterface {
  name = "ToursAuditListSearchColumns1777592100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid NULL`
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_tours_created_by_user_id'
        ) THEN
          ALTER TABLE "tours"
            ADD CONSTRAINT "fk_tours_created_by_user_id"
            FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "starts_on" date NULL`);
    await queryRunner.query(`ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "ends_on" date NULL`);
    await queryRunner.query(
      `ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "currency_code" character varying(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "list_price_minor" bigint NULL`,
    );

    await queryRunner.query(`
      UPDATE "tours" t
      SET
        "starts_on" = CASE
          WHEN (td.trip_details IS NOT NULL
            AND (td.trip_details->'logistics'->>'departureDate') ~ '^\\d{4}-\\d{2}-\\d{2}$')
          THEN (td.trip_details->'logistics'->>'departureDate')::date
          ELSE NULL
        END,
        "ends_on" = CASE
          WHEN (td.trip_details IS NOT NULL
            AND (td.trip_details->'logistics'->>'returnDate') ~ '^\\d{4}-\\d{2}-\\d{2}$')
          THEN (td.trip_details->'logistics'->>'returnDate')::date
          ELSE NULL
        END
      FROM "tour_details" td
      WHERE td.tour_id = t.id
    `);

    await queryRunner.query(`
      UPDATE "tours" t
      SET
        "currency_code" = UPPER(LEFT(COALESCE(NULLIF(TRIM(t.cost_context->>'currency'), ''), 'USD'), 3)),
        "list_price_minor" = CASE
          WHEN t.cost_context IS NOT NULL
            AND (t.cost_context ? 'totalCost')
            AND (t.cost_context->>'totalCost') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN ROUND((t.cost_context->>'totalCost')::numeric * 100)::bigint
          ELSE NULL
        END
      WHERE t.cost_context IS NOT NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tours_tenant_starts_on" ON "tours" ("tenant_id", "starts_on")`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tours_title_trgm"
      ON "tours"
      USING gin (lower(title) gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tours_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tours_tenant_starts_on"`);
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "fk_tours_created_by_user_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "created_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "starts_on"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "ends_on"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "currency_code"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "list_price_minor"`);
  }
}
