export const PRESETS_ADVANCED_CONFIG_VERSION = 1;

export type PresetsAdvancedMatchRule = {
  readonly id: string;
  readonly tourType: string | null;
  readonly themeId: string | null;
  readonly presetId: string | null;
  readonly enabled: boolean;
};

export type PresetsAdvancedPayload = {
  readonly autoMatchEnabled: boolean;
  readonly defaultPresetId: string | null;
  readonly matchRules: readonly PresetsAdvancedMatchRule[];
};

export type PresetsAdvancedConfigResponse = {
  readonly configKey: string;
  readonly configVersion: number;
  readonly source: "tenant" | "workspace";
  readonly payload: PresetsAdvancedPayload;
  readonly updatedAt: string | null;
};

export const PRESETS_ADVANCED_TEST_IDS = {
  page: "operator-presets-advanced-page",
  form: "operator-presets-advanced-form",
  autoMatchToggle: "operator-presets-advanced-auto-match",
  defaultPresetInput: "operator-presets-advanced-default-preset",
  ruleIdInput: "operator-presets-advanced-rule-id",
  ruleAddButton: "operator-presets-advanced-rule-add",
  ruleList: "operator-presets-advanced-rule-list",
  saveButton: "operator-presets-advanced-save",
  success: "operator-presets-advanced-success",
} as const;
