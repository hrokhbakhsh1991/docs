-- DP1-A — payment holds + operator_registrations.cancel_source (expand-only).

ALTER TABLE "operator_registrations"
  ADD COLUMN IF NOT EXISTS "cancel_source" TEXT;

CREATE TABLE IF NOT EXISTS "finance_payment_holds" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "registration_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "due_at" TIMESTAMPTZ NOT NULL,
  "policy_hours" INTEGER NOT NULL,
  "extended_count" INTEGER NOT NULL DEFAULT 0,
  "satisfied_at" TIMESTAMPTZ,
  "expired_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_payment_holds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_payment_holds_tenant_id_registration_id_key"
  ON "finance_payment_holds" ("tenant_id", "registration_id");

CREATE INDEX IF NOT EXISTS "finance_payment_holds_tenant_id_status_due_at_idx"
  ON "finance_payment_holds" ("tenant_id", "status", "due_at");

ALTER TABLE "finance_payment_holds"
  ADD CONSTRAINT "finance_payment_holds_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
