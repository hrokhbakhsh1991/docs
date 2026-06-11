import {
  PRESETS_ADVANCED_CONFIG_VERSION,
  type PresetsAdvancedConfigResponse,
  type PresetsAdvancedPayload,
} from "./presets-advanced-types";

export function buildPresetsAdvancedPutBody(payload: PresetsAdvancedPayload): Record<string, unknown> {
  return {
    configVersion: PRESETS_ADVANCED_CONFIG_VERSION,
    payload: {
      autoMatchEnabled: payload.autoMatchEnabled,
      defaultPresetId:
        payload.defaultPresetId === null || payload.defaultPresetId.trim().length === 0
          ? null
          : payload.defaultPresetId.trim(),
      matchRules: payload.matchRules.map((rule) => ({
        id: rule.id,
        tourType: rule.tourType,
        themeId: rule.themeId,
        presetId: rule.presetId,
        enabled: rule.enabled,
      })),
    },
  };
}

export function parsePresetsAdvancedResponse(
  response: PresetsAdvancedConfigResponse
): PresetsAdvancedPayload {
  return {
    autoMatchEnabled: response.payload.autoMatchEnabled === true,
    defaultPresetId: response.payload.defaultPresetId ?? null,
    matchRules: Array.isArray(response.payload.matchRules)
      ? response.payload.matchRules.map((rule) => ({
          id: rule.id,
          tourType: rule.tourType ?? null,
          themeId: rule.themeId ?? null,
          presetId: rule.presetId ?? null,
          enabled: rule.enabled !== false,
        }))
      : [],
  };
}

export function isPresetsAdvancedPersisted(
  before: PresetsAdvancedPayload,
  after: PresetsAdvancedPayload
): boolean {
  return before.autoMatchEnabled !== after.autoMatchEnabled && after.autoMatchEnabled;
}

export function appendPresetsAdvancedMatchRule(
  payload: PresetsAdvancedPayload,
  ruleId: string
): PresetsAdvancedPayload {
  const id = ruleId.trim();
  if (id.length === 0 || payload.matchRules.some((rule) => rule.id === id)) {
    return payload;
  }
  return {
    ...payload,
    matchRules: [
      ...payload.matchRules,
      { id, tourType: null, themeId: null, presetId: null, enabled: true },
    ],
  };
}

export function removePresetsAdvancedMatchRule(
  payload: PresetsAdvancedPayload,
  ruleId: string
): PresetsAdvancedPayload {
  return {
    ...payload,
    matchRules: payload.matchRules.filter((rule) => rule.id !== ruleId),
  };
}
