-- INT-002b — backfill TourPublished event policies for denali Telegram connections.
-- See docs/dev/tour-published-telegram-rollout-plan.mdoc

INSERT INTO integration_event_policies (
  id,
  tenant_id,
  integration_connection_id,
  event_type,
  enabled,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  ic.tenant_id,
  ic.id,
  'TourPublished',
  true,
  NOW(),
  NOW()
FROM integration_connections ic
WHERE ic.provider = 'telegram'
  AND ic.workspace_type = 'denali'
  AND ic.enabled = true
  AND ic.status = 'enabled'
ON CONFLICT ON CONSTRAINT uq_integration_event_policies_conn_event DO NOTHING;

UPDATE integration_event_policies AS ep
SET enabled = false,
    updated_at = NOW()
FROM integration_connections AS ic
WHERE ep.integration_connection_id = ic.id
  AND ic.provider = 'telegram'
  AND ic.workspace_type = 'denali'
  AND ic.enabled = true
  AND ic.status = 'enabled'
  AND ep.event_type = 'TourCreated'
  AND EXISTS (
    SELECT 1
    FROM integration_event_policies AS published
    WHERE published.integration_connection_id = ic.id
      AND published.event_type = 'TourPublished'
  );
