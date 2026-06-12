-- Equipment ↔ tour theme linkage (operator settings multi-select)

ALTER TABLE workspace_equipment
  ADD COLUMN IF NOT EXISTS theme_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
