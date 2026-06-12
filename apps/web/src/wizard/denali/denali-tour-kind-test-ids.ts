import type {
  DenaliEventVariantSlug,
  DenaliTourCategorySlug,
  DenaliTourDurationSlug,
} from "./denali-tour-kind-labels";

export const DENALI_TOUR_KIND_TEST_IDS = {
  tourKind: "denali-composite-tour-kind",
  category: (category: DenaliTourCategorySlug) => `denali-tour-kind-category-${category}`,
  duration: (duration: DenaliTourDurationSlug) => `denali-tour-kind-duration-${duration}`,
  eventVariant: (variant: DenaliEventVariantSlug) => `denali-tour-kind-event-${variant}`,
} as const;
