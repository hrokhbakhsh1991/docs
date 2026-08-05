export const DENALI_SEARCHABLE_SELECT_TEST_IDS = {
  root: "denali-searchable-select",
  trigger: "denali-searchable-select-trigger",
  panel: "denali-searchable-select-panel",
  search: "denali-searchable-select-search",
  option: (value: string) => `denali-searchable-select-option-${value}`,
} as const;
