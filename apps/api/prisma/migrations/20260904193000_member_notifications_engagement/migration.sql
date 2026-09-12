-- MEG-001 — allow engagement badge notifications in shared member_notifications inbox

ALTER TABLE member_notifications
  DROP CONSTRAINT IF EXISTS member_notifications_source_module_check;

ALTER TABLE member_notifications
  ADD CONSTRAINT member_notifications_source_module_check
  CHECK (source_module IN ('ticketing', 'booking', 'finance', 'wallet', 'engagement'));

ALTER TABLE member_notifications
  DROP CONSTRAINT IF EXISTS member_notifications_entity_type_check;

ALTER TABLE member_notifications
  ADD CONSTRAINT member_notifications_entity_type_check
  CHECK (entity_type IN ('ticket', 'registration', 'payment', 'wallet_event', 'engagement_event'));
