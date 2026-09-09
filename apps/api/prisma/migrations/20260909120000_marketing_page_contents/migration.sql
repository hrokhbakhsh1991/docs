-- MKP-001 — tenant-scoped marketing page content (draft + published)

CREATE TABLE IF NOT EXISTS marketing_page_contents (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  page_key TEXT NOT NULL,
  locale TEXT NOT NULL,
  draft_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_payload JSONB,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_page_contents_pkey PRIMARY KEY (tenant_id, workspace_id, page_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_marketing_page_contents_tenant_workspace
  ON marketing_page_contents (tenant_id, workspace_id);

ALTER TABLE marketing_page_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_page_contents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_page_contents_tenant_isolation ON marketing_page_contents;
CREATE POLICY marketing_page_contents_tenant_isolation ON marketing_page_contents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE marketing_page_contents TO app_tour;
