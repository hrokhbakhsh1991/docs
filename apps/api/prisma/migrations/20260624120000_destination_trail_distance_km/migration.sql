-- Replace hiking-hours metadata with trail distance (km)
ALTER TABLE "workspace_destinations" ADD COLUMN IF NOT EXISTS "typical_trail_distance_km" DOUBLE PRECISION;
ALTER TABLE "workspace_destinations" DROP COLUMN IF EXISTS "typical_hiking_hours";
