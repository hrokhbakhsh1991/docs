ALTER TABLE "integration_event_policies"
  ADD COLUMN "selected_field_ids" JSONB,
  ADD COLUMN "message_template" TEXT;
