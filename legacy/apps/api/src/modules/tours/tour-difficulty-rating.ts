/**
 * Difficulty rating used by `tripDetails.overview.difficultyLevel`.
 *
 * Numeric scale `1..10` with `0.5` step granularity (19 allowed values total).
 * Replaces the legacy enum (`easy / moderate / hard / technical`) on the
 * **overview** layer only — `tripDetails.participation.fitnessLevel` and the
 * top-level `tour_details.difficulty` column keep the old enum.
 */
export const DIFFICULTY_RATING_MIN = 1;
export const DIFFICULTY_RATING_MAX = 10;
export const DIFFICULTY_RATING_STEP = 0.5;

function buildRatingValues(): readonly number[] {
  const out: number[] = [];
  const stepsPerUnit = Math.round(1 / DIFFICULTY_RATING_STEP);
  const totalSteps = (DIFFICULTY_RATING_MAX - DIFFICULTY_RATING_MIN) * stepsPerUnit;
  for (let i = 0; i <= totalSteps; i += 1) {
    out.push(DIFFICULTY_RATING_MIN + i * DIFFICULTY_RATING_STEP);
  }
  return Object.freeze(out);
}

export const DIFFICULTY_RATING_VALUES = buildRatingValues();
export type DifficultyRating = number;

/** True when `value` is a half-step inside the configured `[min, max]` band. */
export function isValidDifficultyRating(value: unknown): value is DifficultyRating {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < DIFFICULTY_RATING_MIN || value > DIFFICULTY_RATING_MAX) return false;
  return Number.isInteger(value * Math.round(1 / DIFFICULTY_RATING_STEP));
}
