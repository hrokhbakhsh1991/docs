import type { MigrationInterface, QueryRunner } from "typeorm";

export class TourProductsDeparturesAndPrices1777593000000 implements MigrationInterface {
  name = "TourProductsDeparturesAndPrices1777593000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tour_price_type_enum" AS ENUM (
          'base', 'early_bird', 'group', 'vip', 'promo', 'dynamic'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tour_products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "slug" character varying(255),
        "description" text,
        "settings" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_products" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_products_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tour_products"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', COALESCE("title", '')), 'A')
        || setweight(to_tsvector('simple', COALESCE("description", '')), 'B')
      ) STORED
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tour_products_tenant_slug"
      ON "tour_products" ("tenant_id", "slug")
      WHERE "slug" IS NOT NULL AND btrim("slug") <> ''
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_products_tenant_id" ON "tour_products" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_products_search_vector"
      ON "tour_products" USING gin ("search_vector")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tour_departures" (
        "id" uuid NOT NULL,
        "tour_product_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "starts_on" date,
        "ends_on" date,
        "currency_code" character varying(3),
        "list_price_minor" bigint,
        "lifecycle_status" "public"."tour_lifecycle_status_enum" NOT NULL DEFAULT 'DRAFT',
        "capacity_total" integer NOT NULL DEFAULT 0,
        "reserved_count" integer NOT NULL DEFAULT 0,
        "sold_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_departures" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_departures_product" FOREIGN KEY ("tour_product_id")
          REFERENCES "tour_products"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tour_departures_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "CHK_tour_departures_nonneg" CHECK (
          "reserved_count" >= 0 AND "sold_count" >= 0 AND "capacity_total" >= 0
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_departures_tenant_starts"
      ON "tour_departures" ("tenant_id", "starts_on")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_departures_product_id" ON "tour_departures" ("tour_product_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tour_prices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tour_departure_id" uuid NOT NULL,
        "price_type" "public"."tour_price_type_enum" NOT NULL DEFAULT 'base',
        "currency_code" character varying(3) NOT NULL,
        "amount_minor" bigint NOT NULL,
        "conditions_json" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tour_prices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tour_prices_departure" FOREIGN KEY ("tour_departure_id")
          REFERENCES "tour_departures"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tour_prices_departure" ON "tour_prices" ("tour_departure_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "tour_product_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "tour_departure_id" uuid
    `);

    await queryRunner.query(`
      CREATE TEMP TABLE IF NOT EXISTS "_tmp_tour_product_map" (
        "tour_id" uuid NOT NULL PRIMARY KEY,
        "product_id" uuid NOT NULL
      )
    `);
    await queryRunner.query(`
      INSERT INTO "_tmp_tour_product_map" ("tour_id", "product_id")
      SELECT "id", gen_random_uuid() FROM "tours"
    `);

    await queryRunner.query(`
      INSERT INTO "tour_products" ("id", "tenant_id", "title", "description", "created_at", "updated_at")
      SELECT
        m."product_id",
        t."tenant_id",
        t."title",
        t."description",
        t."created_at",
        t."updated_at"
      FROM "tours" t
      INNER JOIN "_tmp_tour_product_map" m ON m."tour_id" = t."id"
    `);

    await queryRunner.query(`
      INSERT INTO "tour_departures" (
        "id",
        "tour_product_id",
        "tenant_id",
        "starts_on",
        "ends_on",
        "currency_code",
        "list_price_minor",
        "lifecycle_status",
        "capacity_total",
        "reserved_count",
        "sold_count",
        "created_at",
        "updated_at"
      )
      SELECT
        t."id",
        m."product_id",
        t."tenant_id",
        CASE
          WHEN td."trip_details" IS NOT NULL
            AND (td."trip_details"->'logistics'->>'departureDate') ~ '^\\d{4}-\\d{2}-\\d{2}$'
          THEN (td."trip_details"->'logistics'->>'departureDate')::date
          ELSE NULL
        END,
        CASE
          WHEN td."trip_details" IS NOT NULL
            AND (td."trip_details"->'logistics'->>'returnDate') ~ '^\\d{4}-\\d{2}-\\d{2}$'
          THEN (td."trip_details"->'logistics'->>'returnDate')::date
          ELSE NULL
        END,
        UPPER(LEFT(COALESCE(NULLIF(TRIM(t."cost_context"->>'currency'), ''), 'USD'), 3)),
        CASE
          WHEN t."cost_context" IS NOT NULL
            AND (t."cost_context" ? 'totalCost')
            AND (t."cost_context"->>'totalCost') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN ROUND((t."cost_context"->>'totalCost')::numeric * 100)::bigint
          ELSE NULL
        END,
        t."lifecycle_status",
        t."total_capacity",
        0,
        t."accepted_count",
        t."created_at",
        t."updated_at"
      FROM "tours" t
      INNER JOIN "_tmp_tour_product_map" m ON m."tour_id" = t."id"
      LEFT JOIN "tour_details" td ON td."tour_id" = t."id"
    `);

    await queryRunner.query(`
      INSERT INTO "tour_prices" ("id", "tour_departure_id", "price_type", "currency_code", "amount_minor", "created_at")
      SELECT
        gen_random_uuid(),
        d."id",
        'base',
        COALESCE(NULLIF(TRIM(d."currency_code"), ''), 'USD'),
        COALESCE(d."list_price_minor", 0),
        d."created_at"
      FROM "tour_departures" d
      WHERE NOT EXISTS (SELECT 1 FROM "tour_prices" p WHERE p."tour_departure_id" = d."id")
    `);

    await queryRunner.query(`
      UPDATE "tours" t
      SET
        "tour_product_id" = m."product_id",
        "tour_departure_id" = t."id"
      FROM "_tmp_tour_product_map" m
      WHERE m."tour_id" = t."id"
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tours_tour_product_id'
        ) THEN
          ALTER TABLE "tours"
          ADD CONSTRAINT "FK_tours_tour_product_id"
          FOREIGN KEY ("tour_product_id") REFERENCES "tour_products"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tours_tour_departure_id'
        ) THEN
          ALTER TABLE "tours"
          ADD CONSTRAINT "FK_tours_tour_departure_id"
          FOREIGN KEY ("tour_departure_id") REFERENCES "tour_departures"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "_tmp_tour_product_map"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "FK_tours_tour_departure_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "FK_tours_tour_product_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "tour_departure_id"`);
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "tour_product_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "tour_prices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tour_departures"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tour_products"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tour_price_type_enum"`);
  }
}
