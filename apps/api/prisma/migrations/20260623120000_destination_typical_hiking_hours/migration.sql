-- Destination optional hiking-hours metadata (Denali catalog prefill)
ALTER TABLE "workspace_destinations" ADD COLUMN IF NOT EXISTS "typical_hiking_hours" INTEGER;
