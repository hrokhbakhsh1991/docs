-- BOOKINGS-OPS-UX P3b-a — departureAt ASC keyset for GET /bookings?sort=departureAt
-- Apply as table owner (postgres) when app_tour lacks CREATE INDEX privilege.
CREATE INDEX IF NOT EXISTS "idx_operator_registrations_tenant_departure_id"
  ON "operator_registrations"("tenant_id", "departure_at", "id");
