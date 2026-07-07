-- Intent-scoped Telegram field decoration prefixes (emoji/text markers).
ALTER TABLE "exposure_intents"
ADD COLUMN "field_decorations" JSONB;
