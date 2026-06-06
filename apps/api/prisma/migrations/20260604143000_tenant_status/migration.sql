-- Phase 4.3 — tenant lifecycle column for provisioning
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
