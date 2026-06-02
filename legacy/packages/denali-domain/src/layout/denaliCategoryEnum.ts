import {
  DENALI_TOUR_CATEGORY_VALUES,
  type DenaliTourCategory,
} from "@repo/types";

/**
 * Denali tour categories for equipment compatibility and wizard basics.
 * Single source for multi-select gear settings (do not hardcode in UI).
 */
export const DENALI_CATEGORY_ENUM = DENALI_TOUR_CATEGORY_VALUES;

export type DenaliCategoryEnum = DenaliTourCategory;

const CATEGORY_SET = new Set<string>(DENALI_CATEGORY_ENUM);

export function isDenaliCategoryEnum(value: string): value is DenaliCategoryEnum {
  return CATEGORY_SET.has(value);
}

export function normalizeCompatibleCategories(
  values: readonly string[] | undefined | null,
): DenaliCategoryEnum[] {
  if (!values?.length) {
    return [];
  }
  const seen = new Set<DenaliCategoryEnum>();
  for (const raw of values) {
    const trimmed = String(raw).trim().toLowerCase();
    if (isDenaliCategoryEnum(trimmed)) {
      seen.add(trimmed);
    }
  }
  return DENALI_CATEGORY_ENUM.filter((c) => seen.has(c));
}

/** Maps legacy free-text `category` column values when they match enum slugs. */
export function migrateLegacyEquipmentCategory(
  legacyCategory: string | null | undefined,
): DenaliCategoryEnum[] {
  if (legacyCategory == null) {
    return [];
  }
  const trimmed = legacyCategory.trim().toLowerCase();
  if (isDenaliCategoryEnum(trimmed)) {
    return [trimmed];
  }
  return [];
}
