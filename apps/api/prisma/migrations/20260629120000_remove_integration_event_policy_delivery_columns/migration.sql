INSERT INTO integration_delivery_intents (
  tenant_id,
  workspace_type,
  integration_connection_id,
  event_type,
  selected_field_ids,
  template_id,
  enabled,
  created_at,
  updated_at
)
SELECT
  ep.tenant_id,
  ic.workspace_type,
  ep.integration_connection_id,
  ep.event_type,
  COALESCE(ep.selected_field_ids, '[]'::jsonb),
  ep.message_template,
  (ep.selected_field_ids IS NOT NULL),
  ep.created_at,
  ep.updated_at
FROM integration_event_policies ep
INNER JOIN integration_connections ic ON ic.id = ep.integration_connection_id
WHERE ep.selected_field_ids IS NOT NULL
   OR ep.message_template IS NOT NULL
ON CONFLICT (integration_connection_id, event_type) DO NOTHING;

INSERT INTO exposure_intents (
  tenant_id,
  workspace_type,
  profile_id,
  entity_type,
  surface,
  audience,
  trigger,
  scope,
  scope_hash,
  mode,
  selected_field_ids,
  template_override_id,
  source,
  created_at,
  updated_at
)
SELECT
  idi.tenant_id,
  ic.workspace_type,
  CONCAT(
    COALESCE(NULLIF(TRIM(ic.workspace_type), ''), 'unknown'),
    '.',
    ic.provider,
    '.',
    idi.event_type
  ),
  'tour',
  ic.provider,
  'external_channel',
  idi.event_type,
  jsonb_build_object('connectionId', idi.integration_connection_id::text),
  CONCAT('{"connectionId":"', idi.integration_connection_id::text, '"}'),
  CASE WHEN idi.enabled THEN 'override_fields' ELSE 'inherit_profile' END,
  CASE WHEN idi.enabled THEN idi.selected_field_ids ELSE NULL END,
  idi.template_id,
  'integration_event_policy_column_cleanup',
  idi.created_at,
  idi.updated_at
FROM integration_delivery_intents idi
INNER JOIN integration_connections ic ON ic.id = idi.integration_connection_id
ON CONFLICT (tenant_id, profile_id, surface, audience, trigger, scope_hash) DO NOTHING;

ALTER TABLE integration_event_policies
  DROP COLUMN IF EXISTS selected_field_ids,
  DROP COLUMN IF EXISTS message_template;
