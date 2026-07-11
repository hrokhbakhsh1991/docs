/** AP15 P3 — bounded connection-scoped exposure intent list reads. */
export const MAX_EXPOSURE_INTENTS_PER_CONNECTION = 100;
export const MAX_EXPOSURE_INTENTS_CONNECTION_BATCH = 500;

export const EXPOSURE_INTENT_LIST_SELECT = {
  id: true,
  workspaceType: true,
  profileId: true,
  entityType: true,
  surface: true,
  audience: true,
  trigger: true,
  scope: true,
  mode: true,
  selectedFieldIds: true,
  fieldDecorations: true,
  templateOverrideId: true,
  createdAt: true,
  updatedAt: true,
} as const;
