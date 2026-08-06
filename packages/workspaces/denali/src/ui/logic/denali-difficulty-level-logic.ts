import { type AppLocale, toLocalizedDigits } from "../adapters/i18n-format";

export const DIFFICULTY_LEVEL_MIN = 1;
export const DIFFICULTY_LEVEL_MAX = 10;
export const DIFFICULTY_LEVEL_STEP = 0.5;
/** Visual park for unset thumb — min aligns with empty fill; never auto-seed draft (INV-DENALI-WIZ-010). */
export const DIFFICULTY_LEVEL_SLIDER_UNSET_POSITION = DIFFICULTY_LEVEL_MIN;

export function snapDifficultyLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return DIFFICULTY_LEVEL_MIN;
  }
  const snapped = Math.round(value / DIFFICULTY_LEVEL_STEP) * DIFFICULTY_LEVEL_STEP;
  return Math.min(DIFFICULTY_LEVEL_MAX, Math.max(DIFFICULTY_LEVEL_MIN, snapped));
}

/** Parse stored difficulty; empty / invalid → `null` (unset — not a phantom mid value). */
export function parseDifficultyLevel(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
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
