-- Phase 11.8 — destination peak prefill + theme formProfile filter
ALTER TABLE "workspace_destinations" ADD COLUMN IF NOT EXISTS "altitude_m" INTEGER;

ALTER TABLE "workspace_tour_themes" ADD COLUMN IF NOT EXISTS "form_profile" TEXT;
