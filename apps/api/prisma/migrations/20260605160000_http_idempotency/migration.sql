-- P0 DEC-006 — HTTP Idempotency-Key records (tenant-scoped, RLS)

CREATE TABLE "http_idempotency_records" (
  "tenant_id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "status_code" INTEGER,
  "response_body" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "http_idempotency_records_pkey" PRIMARY KEY ("tenant_id", "idempotency_key")
);

CREATE INDEX "http_idempotency_records_tenant_status_idx"
  ON "http_idempotency_records" ("tenant_id", "status");

ALTER TABLE "http_idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "http_idempotency_records" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS http_idempotency_tenant_isolation ON "http_idempotency_records";
CREATE POLICY http_idempotency_tenant_isolation ON "http_idempotency_records"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
