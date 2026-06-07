-- Phase 8.2 — Urban product parity (catalog projections + registration intake)
-- Pair with apps/api/prisma/migrations/20260608100000_urban_product_delta/

ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE tours
  DROP CONSTRAINT IF EXISTS chk_tours_publish_status;
ALTER TABLE tours
  ADD CONSTRAINT chk_tours_publish_status
  CHECK (publish_status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_tours_tenant_publish_catalog
  ON tours (tenant_id, publish_status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tours_tenant_city_publish
  ON tours (tenant_id, city, publish_status);

CREATE TABLE IF NOT EXISTS urban_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  party_size INT,
  status TEXT NOT NULL DEFAULT 'waitlist',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_urban_reg_status CHECK (status IN ('waitlist', 'confirmed', 'cancelled')),
  CONSTRAINT fk_urban_reg_tour FOREIGN KEY (tenant_id, tour_id)
    REFERENCES tours (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_urban_reg_tenant_tour_email
  ON urban_registrations (tenant_id, tour_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_urban_reg_tenant_tour_created
  ON urban_registrations (tenant_id, tour_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_urban_reg_tenant_email
  ON urban_registrations (tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_urban_reg_tenant_status_created
  ON urban_registrations (tenant_id, status, created_at DESC);
