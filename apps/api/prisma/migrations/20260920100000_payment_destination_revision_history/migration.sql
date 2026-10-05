-- T05-CARD-RACE: immutable destination history and one-to-one receipt snapshots.
CREATE TABLE IF NOT EXISTS payment_destination_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  revision TEXT NOT NULL UNIQUE,
  card_number TEXT NOT NULL,
  card_holder_name TEXT NOT NULL,
  bank_name TEXT,
  instructions TEXT,
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_destination_revisions_tenant_created
  ON payment_destination_revisions (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_destination_revisions_tenant_revision_key
  ON payment_destination_revisions (tenant_id, revision);

CREATE TABLE IF NOT EXISTS payment_receipt_destination_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  payment_receipt_id UUID NOT NULL UNIQUE REFERENCES payment_receipts(id) ON DELETE CASCADE,
  revision TEXT NOT NULL,
  card_number TEXT NOT NULL,
  card_holder_name TEXT NOT NULL,
  bank_name TEXT,
  instructions TEXT,
  CONSTRAINT payment_receipt_destination_snapshots_revision_fk
    FOREIGN KEY (tenant_id, revision)
    REFERENCES payment_destination_revisions (tenant_id, revision),
  CONSTRAINT payment_receipt_destination_snapshots_tenant_receipt_key
    UNIQUE (tenant_id, payment_receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_receipt_destination_snapshots_tenant_revision
  ON payment_receipt_destination_snapshots (tenant_id, revision);

ALTER TABLE payment_destination_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_destination_revisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_destination_revisions_tenant_isolation
  ON payment_destination_revisions;
CREATE POLICY payment_destination_revisions_tenant_isolation
  ON payment_destination_revisions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE payment_receipt_destination_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipt_destination_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_receipt_destination_snapshots_tenant_isolation
  ON payment_receipt_destination_snapshots;
CREATE POLICY payment_receipt_destination_snapshots_tenant_isolation
  ON payment_receipt_destination_snapshots
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT ON payment_destination_revisions TO app_tour;
GRANT SELECT, INSERT ON payment_receipt_destination_snapshots TO app_tour;
