import { type AppLocale, toLocalizedDigits } from "../adapters/i18n-format";

export const DIFFICULTY_LEVEL_MIN = 1;
export const DIFFICULTY_LEVEL_MAX = 10;
export const DIFFICULTY_LEVEL_STEP = 0.5;
export const DIFFICULTY_LEVEL_DEFAULT = 5;

export function snapDifficultyLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return DIFFICULTY_LEVEL_DEFAULT;
  }
  const snapped = Math.round(value / DIFFICULTY_LEVEL_STEP) * DIFFICULTY_LEVEL_STEP;
  return Math.min(DIFFICULTY_LEVEL_MAX, Math.max(DIFFICULTY_LEVEL_MIN, snapped));
}

export function parseDifficultyLevel(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return DIFFICULTY_LEVEL_DEFAULT;
  }
  const parsed = Number.parseFloat(trimmed);
  return snapDifficultyLevel(parsed);
}

export function formatDifficultyLevelStorage(value: number): string {
  const snapped = snapDifficultyLevel(value);
  if (Number.isInteger(snapped)) {
    return String(snapped);
  }
  return snapped.toFixed(1);
}

export function formatDifficultyLevelDisplay(value: number, locale: AppLocale): string {
  return toLocalizedDigits(formatDifficultyLevelStorage(value), locale);
}

export function difficultyLevelSliderProgress(value: number): number {
  const snapped = snapDifficultyLevel(value);
  return ((snapped - DIFFICULTY_LEVEL_MIN) / (DIFFICULTY_LEVEL_MAX - DIFFICULTY_LEVEL_MIN)) * 100;
}
