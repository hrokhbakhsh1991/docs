-- Persist the exact approved roster and car allocations used for DP-5 settlement.
ALTER TABLE "transport_roster_freezes"
  ADD COLUMN IF NOT EXISTS "roster_snapshot" JSONB;
