-- Phase 9.5 operator bookings delta (see infra/sql/006_operator_bookings_delta.sql)

CREATE TABLE IF NOT EXISTS operator_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL,
  tour_title TEXT NOT NULL,
  guest_label TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  party_size INT NOT NULL CHECK (party_size > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  departure_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by_user_id UUID NOT NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_registrations_tenant_status
  ON operator_registrations (tenant_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_operator_registrations_tenant_tour
  ON operator_registrations (tenant_id, tour_id, submitted_at DESC);

ALTER TABLE operator_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_registrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operator_registrations_tenant_isolation ON operator_registrations;
CREATE POLICY operator_registrations_tenant_isolation ON operator_registrations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_tenants TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE mobile_otp_challenges TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE operator_pending_invites TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE operator_registrations TO app_tour;
