export function parseThemeIdsJson(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function normalizeThemeIdsInput(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("INVALID_THEME_IDS");
  }
  return parseThemeIdsJson(value);
}
