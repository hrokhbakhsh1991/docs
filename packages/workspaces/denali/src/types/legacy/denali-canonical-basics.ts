import type { DenaliTourKind } from "./denali-tour-kind";

export type DenaliTourCategory = "mountain" | "nature" | "desert" | "event";

export const DENALI_TOUR_CATEGORY_VALUES = ["mountain", "nature", "desert", "event"] as const;

export type DenaliTourDuration = "single_day" | "multi_day";

export const DENALI_TOUR_DURATION_VALUES = ["single_day", "multi_day"] as const;

export type DenaliEventVariant = "reading" | "cinema";

export const DENALI_EVENT_VARIANT_VALUES = ["reading", "cinema"] as const;

export type DenaliCanonicalBasicsSelection = {
  category: DenaliTourCategory;
  duration: DenaliTourDuration;
  eventVariant?: DenaliEventVariant;
};

export function isDenaliOutdoorCategory(
  category: DenaliTourCategory
): category is "mountain" | "nature" | "desert" {
  return category !== "event";
}

export function denaliCategoryRequiresEventVariant(category: DenaliTourCategory): boolean {
  return category === "event";
}

export function denaliCanonicalBasicsFromTourKind(
  kind: DenaliTourKind | undefined
): DenaliCanonicalBasicsSelection | null {
  if (kind == null) return null;
  if (kind === "event_cinema") {
    return { category: "event", duration: "single_day", eventVariant: "cinema" };
  }
  if (kind === "event_reading") {
    return { category: "event", duration: "single_day", eventVariant: "reading" };
  }
  const duration: DenaliTourDuration = kind.endsWith("_multi") ? "multi_day" : "single_day";
  if (kind.startsWith("mountain_")) return { category: "mountain", duration };
  if (kind.startsWith("nature_")) return { category: "nature", duration };
  if (kind.startsWith("desert_")) return { category: "desert", duration };
  return null;
}

export function isDenaliMountainCategory(category: DenaliTourCategory): boolean {
  return category === "mountain";
}

export function denaliTourKindFromCanonical(input: {
  category: DenaliTourCategory;
  duration: DenaliTourDuration;
  eventVariant?: DenaliEventVariant;
}): DenaliTourKind {
  const multi = input.duration === "multi_day";
  switch (input.category) {
    case "mountain":
      return multi ? "mountain_multi" : "mountain_day";
    case "nature":
      return multi ? "nature_multi" : "nature_day";
    case "desert":
      return multi ? "desert_multi" : "desert_day";
    case "event": {
      const variant = input.eventVariant ?? "reading";
      if (variant === "cinema") return "event_cinema";
      return "event_reading";
    }
    default: {
      const _exhaustive: never = input.category;
      return _exhaustive;
    }
  }
}
