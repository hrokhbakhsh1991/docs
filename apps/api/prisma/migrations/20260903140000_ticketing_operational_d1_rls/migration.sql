-- TKT-001 Phase D1 — operational ticketing (tags, queues, teams) + ticket routing columns

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS queue_id UUID,
  ADD COLUMN IF NOT EXISTS assignee_team_id UUID;

CREATE TABLE IF NOT EXISTS ticket_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  label TEXT NOT NULL,
  color_token TEXT,
  archived_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_tags_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT ticket_tags_tenant_code_key UNIQUE (tenant_id, code),
  CONSTRAINT ticket_tags_code_length_check
    CHECK (char_length(code) >= 2 AND char_length(code) <= 64)
);

CREATE TABLE IF NOT EXISTS ticket_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_teams_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT ticket_teams_tenant_code_key UNIQUE (tenant_id, code),
  CONSTRAINT ticket_teams_code_length_check
    CHECK (char_length(code) >= 2 AND char_length(code) <= 64)
);

CREATE TABLE IF NOT EXISTS ticket_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_id UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  row_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ticket_queues_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT ticket_queues_tenant_code_key UNIQUE (tenant_id, code),
  CONSTRAINT ticket_queues_code_length_check
    CHECK (char_length(code) >= 2 AND char_length(code) <= 64),
  CONSTRAINT ticket_queues_tenant_team_fkey
    FOREIGN KEY (tenant_id, team_id) REFERENCES ticket_teams (tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_queues_tenant_enabled_sort
  ON ticket_queues (tenant_id, enabled, sort_order);

ALTER TABLE tickets
  ADD CONSTRAINT tickets_tenant_queue_fkey
    FOREIGN KEY (tenant_id, queue_id) REFERENCES ticket_queues (tenant_id, id) ON DELETE SET NULL;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_tenant_assignee_team_fkey
    FOREIGN KEY (tenant_id, assignee_team_id) REFERENCES ticket_teams (tenant_id, id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_assignee_team_status
  ON tickets (tenant_id, assignee_team_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_queue_status
  ON tickets (tenant_id, queue_id, status);

CREATE TABLE IF NOT EXISTS ticket_team_members (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, team_id, user_id),
  CONSTRAINT ticket_team_members_tenant_team_fkey
    FOREIGN KEY (tenant_id, team_id) REFERENCES ticket_teams (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_team_members_tenant_user
  ON ticket_team_members (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS ticket_tag_assignments (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL,
  tag_code VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, ticket_id, tag_code),
  CONSTRAINT ticket_tag_assignments_tenant_ticket_fkey
    FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_tag_assignments_tenant_tag_fkey
    FOREIGN KEY (tenant_id, tag_code) REFERENCES ticket_tags (tenant_id, code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_tag_assignments_tenant_tag
  ON ticket_tag_assignments (tenant_id, tag_code);

-- Tenant RLS (ENABLE + FORCE)
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_tags_tenant_isolation ON ticket_tags;
CREATE POLICY ticket_tags_tenant_isolation ON ticket_tags
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tag_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_tag_assignments_tenant_isolation ON ticket_tag_assignments;
CREATE POLICY ticket_tag_assignments_tenant_isolation ON ticket_tag_assignments
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_queues FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_queues_tenant_isolation ON ticket_queues;
CREATE POLICY ticket_queues_tenant_isolation ON ticket_queues
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_teams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_teams_tenant_isolation ON ticket_teams;
CREATE POLICY ticket_teams_tenant_isolation ON ticket_teams
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

ALTER TABLE ticket_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_team_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_team_members_tenant_isolation ON ticket_team_members;
CREATE POLICY ticket_team_members_tenant_isolation ON ticket_team_members
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_tags TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_tag_assignments TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_queues TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_teams TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ticket_team_members TO app_tour;
