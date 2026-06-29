-- Phase 9.5b — merge connection-only exposure_intents scopes into route-scoped anchors.
-- Uses trigger as eventType; deletes legacy rows when a route-scoped twin already exists.

WITH legacy AS (
  SELECT
    id,
    tenant_id,
    profile_id,
    surface,
    audience,
    trigger,
    scope->>'connectionId' AS connection_id
  FROM exposure_intents
  WHERE scope ? 'connectionId'
    AND NOT (scope ? 'eventType')
    AND NULLIF(TRIM(scope->>'connectionId'), '') IS NOT NULL
),
updatable AS (
  SELECT legacy.id
  FROM legacy
  WHERE NOT EXISTS (
    SELECT 1
    FROM exposure_intents route
    WHERE route.tenant_id = legacy.tenant_id
      AND route.profile_id = legacy.profile_id
      AND route.surface = legacy.surface
      AND route.audience = legacy.audience
      AND route.trigger = legacy.trigger
      AND route.scope->>'connectionId' = legacy.connection_id
      AND route.scope->>'eventType' = legacy.trigger
  )
)
UPDATE exposure_intents AS ei
SET
  scope = jsonb_build_object(
    'connectionId', ei.scope->>'connectionId',
    'eventType', ei.trigger
  ),
  scope_hash = (
    '{"connectionId":"'
    || replace(ei.scope->>'connectionId', '"', '')
    || '","eventType":"'
    || replace(ei.trigger, '"', '')
    || '"}'
  )
FROM updatable
WHERE ei.id = updatable.id;

DELETE FROM exposure_intents
WHERE scope ? 'connectionId'
  AND NOT (scope ? 'eventType')
  AND NULLIF(TRIM(scope->>'connectionId'), '') IS NOT NULL;
