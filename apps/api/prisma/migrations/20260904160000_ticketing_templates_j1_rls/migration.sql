-- TKT-001 Phase J1 — ticketing templates, revisions, automation activations

CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel VARCHAR(32) NOT NULL,
  locale VARCHAR(8) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  workspace_type TEXT,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_templates_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT uq_ticket_templates_scope UNIQUE (tenant_id, code, channel, locale),
  CONSTRAINT ticket_templates_channel_check CHECK (
    channel IN ('public_reply', 'internal_note', 'email', 'sms', 'sla_warning', 'sla_breach')
  ),
  CONSTRAINT ticket_templates_locale_check CHECK (locale IN ('en', 'fa'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_templates_tenant_channel
  ON ticket_templates (tenant_id, channel, locale, enabled);

CREATE TABLE IF NOT EXISTS ticket_template_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel VARCHAR(32) NOT NULL,
  locale VARCHAR(8) NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID,
  CONSTRAINT ticket_template_revisions_tenant_template_fkey
    FOREIGN KEY (tenant_id, template_id) REFERENCES ticket_templates (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_ticket_template_revisions_version UNIQUE (tenant_id, template_id, version)
);

CREATE TABLE IF NOT EXISTS ticket_template_automation_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_event_id VARCHAR(128) NOT NULL,
  template_code VARCHAR(64) NOT NULL,
  locale VARCHAR(8) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  ticket_id UUID,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ticket_template_automation_activations
    UNIQUE (tenant_id, domain_event_id, template_code, locale, channel)
);

ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_templates_tenant_isolation ON ticket_templates;
CREATE POLICY ticket_templates_tenant_isolation ON ticket_templates
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_template_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_template_revisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_template_revisions_tenant_isolation ON ticket_template_revisions;
CREATE POLICY ticket_template_revisions_tenant_isolation ON ticket_template_revisions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_template_automation_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_template_automation_activations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_template_automation_activations_tenant_isolation ON ticket_template_automation_activations;
CREATE POLICY ticket_template_automation_activations_tenant_isolation ON ticket_template_automation_activations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_templates TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_template_revisions TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_template_automation_activations TO app_tour;
