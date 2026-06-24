-- Equipment catalog visual token (Denali iconKey registry)

ALTER TABLE workspace_equipment
  ADD COLUMN IF NOT EXISTS icon_key TEXT;
