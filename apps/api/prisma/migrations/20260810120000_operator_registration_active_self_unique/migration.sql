-- Replace submitter-wide unique with self-only unique (Denali self vs other).
-- Authority: docs/workspaces/denali/registration-self-other-uniqueness.mdoc
-- Amends MR-P0-011 / 20260720150000_operator_registration_active_guest_uniques

DROP INDEX IF EXISTS uq_operator_reg_active_user;

CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_reg_active_self
  ON operator_registrations (tenant_id, tour_id, submitted_by_user_id)
  WHERE status NOT IN ('cancelled', 'rejected')
    AND coalesce(registration_intake ->> 'registrantTarget', 'self') = 'self';
