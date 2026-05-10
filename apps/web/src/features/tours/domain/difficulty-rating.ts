/**
 * Difficulty rating mirror of `apps/api/src/modules/tours/tour-difficulty-rating.ts`.
 *
 * Numeric scale `1..10` with `0.5` step granularity (19 allowed values total).
 * Used for `tripDetails.overview.difficultyLevel`. Other difficulty fields
 * (top-level `tour_details.difficulty`, `participation.fitnessLevel`) keep
 * the legacy enum.
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

export function isValidDifficultyRating(value: unknown): value is DifficultyRating {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < DIFFICULTY_RATING_MIN || value > DIFFICULTY_RATING_MAX) return false;
  return Number.isInteger(value * Math.round(1 / DIFFICULTY_RATING_STEP));
}

/** Render the rating as a digit string (e.g. `1`, `2.5`, `10`) — no trailing `.0`. */
export function formatDifficultyRating(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
