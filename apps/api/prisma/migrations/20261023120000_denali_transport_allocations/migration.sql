-- DP-5 — durable tenant-scoped passenger-to-vehicle assignments.

CREATE UNIQUE INDEX IF NOT EXISTS "operator_registrations_tenant_id_id_key"
  ON "operator_registrations" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_operator_registrations_tenant_tour_id"
  ON "operator_registrations" ("tenant_id", "tour_id", "id");

CREATE TABLE "transport_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "tour_id" UUID NOT NULL,
  "driver_registration_id" UUID NOT NULL,
  "passenger_registration_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_by_user_id" UUID NOT NULL,
  CONSTRAINT "transport_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_transport_allocation_passenger"
    UNIQUE ("tenant_id", "passenger_registration_id"),
  CONSTRAINT "uq_transport_allocation_tour_passenger"
    UNIQUE ("tenant_id", "tour_id", "passenger_registration_id"),
  CONSTRAINT "transport_allocations_driver_not_passenger_check"
    CHECK ("driver_registration_id" <> "passenger_registration_id"),
  CONSTRAINT "transport_allocations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_allocations_tenant_tour_fkey"
    FOREIGN KEY ("tenant_id", "tour_id") REFERENCES "tours" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_allocations_tenant_driver_fkey"
    FOREIGN KEY ("tenant_id", "tour_id", "driver_registration_id")
    REFERENCES "operator_registrations" ("tenant_id", "tour_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_allocations_tenant_passenger_fkey"
    FOREIGN KEY ("tenant_id", "tour_id", "passenger_registration_id")
    REFERENCES "operator_registrations" ("tenant_id", "tour_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_transport_allocations_driver"
  ON "transport_allocations" ("tenant_id", "tour_id", "driver_registration_id");
CREATE INDEX "idx_transport_allocations_tour"
  ON "transport_allocations" ("tenant_id", "tour_id");

ALTER TABLE "transport_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transport_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transport_allocations_tenant_isolation" ON "transport_allocations"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "transport_allocations" TO app_tour;

CREATE TABLE "transport_roster_freezes" (
  "tenant_id" UUID NOT NULL,
  "tour_id" UUID NOT NULL,
  "frozen_at" TIMESTAMPTZ NOT NULL,
  "frozen_by_user_id" UUID NOT NULL,
  "driver_compensation_per_seat_minor" TEXT NOT NULL,
  "currency" VARCHAR(8) NOT NULL,
  CONSTRAINT "transport_roster_freezes_pkey" PRIMARY KEY ("tenant_id", "tour_id"),
  CONSTRAINT "transport_roster_freezes_tenant_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transport_roster_freezes_tenant_tour_fkey"
    FOREIGN KEY ("tenant_id", "tour_id") REFERENCES "tours" ("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "transport_roster_freezes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transport_roster_freezes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transport_roster_freezes_tenant_isolation" ON "transport_roster_freezes"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "transport_roster_freezes" TO app_tour;
