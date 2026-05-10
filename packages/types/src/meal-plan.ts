/** Allowed `tripDetails.logistics.mealPlan` value (single choice). */
export const MEAL_PLAN_VALUES = ["none", "breakfast", "half_board", "full_board", "self_catering"] as const;

export type MealPlanSlug = (typeof MEAL_PLAN_VALUES)[number];

const SLUG_SET = new Set<string>(MEAL_PLAN_VALUES);

/**
 * Normalizes DTO/input to a slug or `undefined`. Unknown strings become `undefined` (validation rejects).
 */
export function normalizeMealPlanForDto(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const v = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v) {
    return undefined;
  }
  if (SLUG_SET.has(v)) {
    return v;
  }
  return undefined;
}

/**
 * Best-effort migration from legacy free-text `mealPlan` strings.
 * Unmatched copy goes to `mealNotes`.
 */
export function parseLegacyMealPlanString(raw: string): { plan?: MealPlanSlug; remainder: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { remainder: "" };
  }

  const slug = trimmed.toLowerCase().replace(/\s+/g, "_");
  if (SLUG_SET.has(slug)) {
    return { plan: slug as MealPlanSlug, remainder: "" };
  }

  const lower = trimmed.toLowerCase();
  if ((lower.includes("full") && lower.includes("board")) || lower.includes("full_board")) {
    return { plan: "full_board", remainder: "" };
  }
  if ((lower.includes("half") && lower.includes("board")) || lower.includes("half_board")) {
    return { plan: "half_board", remainder: "" };
  }
  if (/\b(breakfast|b&b|bed\s+and\s+breakfast)\b/i.test(trimmed) && !lower.includes("full board") && !lower.includes("half board")) {
    return { plan: "breakfast", remainder: "" };
  }
  if (/\b(self[\s-]?catering|own\s+food|no\s+kitchen|kitchenette)\b/i.test(lower)) {
    return { plan: "self_catering", remainder: "" };
  }
  if (/\b(no\s+meals?|meals?\s+not\s+included|nothing)\b/i.test(lower) || lower === "no") {
    return { plan: "none", remainder: "" };
  }

  return { remainder: trimmed };
}
