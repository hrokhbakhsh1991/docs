import {
  denaliCanonicalBasicsFromTourKind,
  denaliCategoryRequiresEventVariant,
  denaliTourKindFromCanonical,
  type DenaliCanonicalBasicsSelection,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
  type DenaliTourKind,
} from "@repo/types";

/** Read canonical basics from the legacy `basicInfo.tourType` slug (adapter boundary). */
export function readDenaliCanonicalBasics(
  tourType: DenaliTourKind | undefined,
): DenaliCanonicalBasicsSelection | null {
  return denaliCanonicalBasicsFromTourKind(tourType);
}

/** Write canonical basics → legacy slug (only persisted classification field). */
export function writeDenaliTourKindFromCanonicalBasics(
  current: DenaliCanonicalBasicsSelection | null,
  patch: Partial<DenaliCanonicalBasicsSelection>,
): DenaliTourKind | undefined {
  const merged: DenaliCanonicalBasicsSelection = {
    category: patch.category ?? current?.category ?? "mountain",
    duration: patch.duration ?? current?.duration ?? "single_day",
    eventVariant: patch.eventVariant ?? current?.eventVariant,
  };
  if (denaliCategoryRequiresEventVariant(merged.category) && merged.eventVariant == null) {
    merged.eventVariant = "reading";
  }
  if (!denaliCategoryRequiresEventVariant(merged.category)) {
    merged.eventVariant = undefined;
  }
  return denaliTourKindFromCanonical(merged);
}

export function patchDenaliCanonicalBasics(
  tourType: DenaliTourKind | undefined,
  patch: Partial<DenaliCanonicalBasicsSelection>,
): DenaliTourKind {
  const next = writeDenaliTourKindFromCanonicalBasics(readDenaliCanonicalBasics(tourType), patch);
  return next ?? "mountain_day";
}

export type { DenaliTourCategory, DenaliTourDuration, DenaliEventVariant, DenaliCanonicalBasicsSelection };
