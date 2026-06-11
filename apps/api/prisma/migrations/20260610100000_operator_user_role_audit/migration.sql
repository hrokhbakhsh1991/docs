-- Phase 9.4 R7 — role change audit for users directory
CREATE TABLE "operator_user_role_audit" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "old_role" TEXT NOT NULL,
    "new_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_user_role_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_operator_user_role_audit_target" ON "operator_user_role_audit"("tenant_id", "target_user_id", "created_at" DESC);

ALTER TABLE "operator_user_role_audit" ADD CONSTRAINT "operator_user_role_audit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
