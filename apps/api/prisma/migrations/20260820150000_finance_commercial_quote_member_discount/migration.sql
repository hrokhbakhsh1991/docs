-- CQ-2C — member discount provenance on finance commercial quotes

ALTER TABLE finance_commercial_quotes
  ADD COLUMN IF NOT EXISTS member_discount_percentage_applied INTEGER,
  ADD COLUMN IF NOT EXISTS member_discount_minor TEXT,
  ADD COLUMN IF NOT EXISTS member_discount_member_user_id UUID,
  ADD COLUMN IF NOT EXISTS member_discount_membership_reference TEXT;
