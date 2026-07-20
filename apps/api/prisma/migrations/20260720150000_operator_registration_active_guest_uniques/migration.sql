-- MR-P0-011: concurrent-safe active guest uniqueness (not cancelled/rejected).
-- Application still pre-checks; these indexes close the race.

CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_reg_active_email
  ON operator_registrations (tenant_id, tour_id, lower(guest_email))
  WHERE guest_email IS NOT NULL
    AND btrim(guest_email) <> ''
    AND status NOT IN ('cancelled', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_reg_active_user
  ON operator_registrations (tenant_id, tour_id, submitted_by_user_id)
  WHERE status NOT IN ('cancelled', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_reg_active_label
  ON operator_registrations (tenant_id, tour_id, lower(guest_label))
  WHERE status NOT IN ('cancelled', 'rejected');

CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_reg_active_national_id
  ON operator_registrations (
    tenant_id,
    tour_id,
    (registration_intake ->> 'nationalId')
  )
  WHERE registration_intake ? 'nationalId'
    AND nullif(btrim(registration_intake ->> 'nationalId'), '') IS NOT NULL
    AND status NOT IN ('cancelled', 'rejected');
