/** Marketing catalog filters aligned with Denali admin wizard (category family, difficulty 1–10, fitness). */

export const DENALI_MARKETING_CATEGORY_GROUPS = ["mountain", "nature"] as const;

export type DenaliMarketingCategoryGroup = (typeof DENALI_MARKETING_CATEGORY_GROUPS)[number];

export const DENALI_MARKETING_FITNESS_LEVELS = ["low", "medium", "high"] as const;

const DIFFICULTY_MIN = 1;
export const DENALI_MARKETING_DIFFICULTY_MAX = 10;
const DIFFICULTY_MAX = DENALI_MARKETING_DIFFICULTY_MAX;
const DIFFICULTY_STEP = 0.5;

export function buildDenaliMarketingDifficultyLevels(): readonly number[] {
  const levels: number[] = [];
  for (let value = DIFFICULTY_MIN; value <= DIFFICULTY_MAX + Number.EPSILON; value += DIFFICULTY_STEP) {
    levels.push(Math.round(value * 2) / 2);
  }
  return Object.freeze(levels);
}

export const DENALI_MARKETING_DIFFICULTY_LEVELS = buildDenaliMarketingDifficultyLevels();

export function snapDenaliCatalogDifficultyLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return DIFFICULTY_MIN;
  }
  const snapped = Math.round(value / DIFFICULTY_STEP) * DIFFICULTY_STEP;
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, snapped));
}

/** URL `category=mountain|nature` matches admin category family; exact slugs still supported. */
export function matchesDenaliMarketingCategoryFilter(
  tourCategory: string | null | undefined,
  filterCategory: string
): boolean {
  const slug = tourCategory?.trim() ?? "";
  const filter = filterCategory.trim();
  if (slug.length === 0 || filter.length === 0) {
    return false;
  }
  if (filter === "mountain" || filter === "nature") {
    return slug.startsWith(`${filter}_`);
  }
  return slug === filter;
}

export function isDenaliMarketingCategoryGroup(value: string): value is DenaliMarketingCategoryGroup {
  return (DENALI_MARKETING_CATEGORY_GROUPS as readonly string[]).includes(value);
}

export function formatDenaliMarketingDifficultyLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}
