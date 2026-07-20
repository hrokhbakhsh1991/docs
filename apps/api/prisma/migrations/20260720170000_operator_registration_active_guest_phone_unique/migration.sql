-- Hostile audit P1: active guest phone uniqueness (not cancelled/rejected).
-- Closes phone-only identity races omitted from 20260720150000 guest uniques.

CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_reg_active_phone
  ON operator_registrations (tenant_id, tour_id, lower(guest_phone))
  WHERE guest_phone IS NOT NULL
    AND btrim(guest_phone) <> ''
    AND status NOT IN ('cancelled', 'rejected');
