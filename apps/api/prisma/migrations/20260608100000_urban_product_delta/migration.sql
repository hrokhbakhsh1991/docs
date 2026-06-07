-- Phase 8.2 urban product delta (see infra/sql/009_urban_product_delta.sql)

ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "publish_status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ;
ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "venue_name" TEXT;
ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "start_date" DATE;
ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "end_date" DATE;

ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "chk_tours_publish_status";
ALTER TABLE "tours" ADD CONSTRAINT "chk_tours_publish_status"
  CHECK ("publish_status" IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS "idx_tours_tenant_publish_catalog"
  ON "tours" ("tenant_id", "publish_status", "published_at" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "idx_tours_tenant_city_publish"
  ON "tours" ("tenant_id", "city", "publish_status");

CREATE TABLE IF NOT EXISTS "urban_registrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "tour_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "phone" TEXT,
  "party_size" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'waitlist',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "urban_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_urban_reg_status" CHECK ("status" IN ('waitlist', 'confirmed', 'cancelled')),
  CONSTRAINT "urban_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "urban_registrations_tenant_id_tour_id_fkey" FOREIGN KEY ("tenant_id", "tour_id") REFERENCES "tours"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_urban_reg_tenant_tour_email"
  ON "urban_registrations" ("tenant_id", "tour_id", "email");

CREATE INDEX IF NOT EXISTS "idx_urban_reg_tenant_tour_created"
  ON "urban_registrations" ("tenant_id", "tour_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_urban_reg_tenant_email"
  ON "urban_registrations" ("tenant_id", "email");

CREATE INDEX IF NOT EXISTS "idx_urban_reg_tenant_status_created"
  ON "urban_registrations" ("tenant_id", "status", "created_at" DESC);
