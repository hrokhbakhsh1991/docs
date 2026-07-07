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
  'integration_delivery_intent_backfill',
  idi.created_at,
  idi.updated_at
FROM integration_delivery_intents idi
INNER JOIN integration_connections ic ON ic.id = idi.integration_connection_id
ON CONFLICT (tenant_id, profile_id, surface, audience, trigger, scope_hash) DO NOTHING;
