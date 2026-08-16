/**
 * Wizard numeric bounds that only apply when both ends of the pair are visible and set.
 * Matrix/template hide is the skip — do not special-case tour kind in callers.
 */

export const DENALI_CAPACITY_MIN_CANONICAL_PATH = "capacityMin" as const;
export const DENALI_CAPACITY_MAX_CANONICAL_PATH = "capacityMax" as const;
export const DENALI_AGE_MIN_CANONICAL_PATH = "participants.minimumAge" as const;
export const DENALI_AGE_MAX_CANONICAL_PATH = "participants.maximumAge" as const;

export const DENALI_CAPACITY_MIN_AFTER_MAX = "DENALI_CAPACITY_MIN_AFTER_MAX" as const;
export const DENALI_AGE_MIN_AFTER_MAX = "DENALI_AGE_MIN_AFTER_MAX" as const;

export type DenaliNumericPairCode =
  | typeof DENALI_CAPACITY_MIN_AFTER_MAX
  | typeof DENALI_AGE_MIN_AFTER_MAX;

export type DenaliWizardNumericPair = {
  readonly minPath: string;
  readonly maxPath: string;
  readonly code: DenaliNumericPairCode;
  /** Rule-model step used when validating the full draft (no expanded step plan). */
  readonly visibilityStep: "denali_basic" | "denali_pricing";
};

export const DENALI_WIZARD_NUMERIC_PAIRS: readonly DenaliWizardNumericPair[] = [
  {
    minPath: DENALI_CAPACITY_MIN_CANONICAL_PATH,
    maxPath: DENALI_CAPACITY_MAX_CANONICAL_PATH,
    code: DENALI_CAPACITY_MIN_AFTER_MAX,
    visibilityStep: "denali_basic",
  },
  {
    minPath: DENALI_AGE_MIN_CANONICAL_PATH,
    maxPath: DENALI_AGE_MAX_CANONICAL_PATH,
    code: DENALI_AGE_MIN_AFTER_MAX,
    visibilityStep: "denali_pricing",
  },
];

export function parseDenaliWizardFiniteNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

/**
 * ED-NUM-PAIR-01 — true when both values parse and min is strictly greater than max.
 * Empty / unparseable sides return false so required/type checks own those cases.
 */
export function isDenaliNumericMinAfterMax(minRaw: string, maxRaw: string): boolean {
  const min = parseDenaliWizardFiniteNumber(minRaw);
  const max = parseDenaliWizardFiniteNumber(maxRaw);
  if (min == null || max == null) {
    return false;
  }
  return min > max;
}
