-- Phase 9.4 R7+ — membership audit event kinds (suspend · rewards · remove)
ALTER TABLE "operator_user_role_audit"
ADD COLUMN "event_kind" TEXT NOT NULL DEFAULT 'role_change';
