import type { BookingTourChip } from "./bookings-command-center-types";

/** UX-BKG-29 — visible chip budget before overflow select. */
export const BOOKINGS_TOUR_CHIP_VISIBLE_MAX = 7;

/** Soft title cap for chip buttons (full title via native title tooltip). */
export const BOOKINGS_TOUR_CHIP_TITLE_MAX_CHARS = 28;

export function truncateTourChipTitle(
  title: string,
  maxChars: number = BOOKINGS_TOUR_CHIP_TITLE_MAX_CHARS
): string {
  const trimmed = title.trim();
  if (maxChars < 1 || trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars === 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

/**
 * When URL tourId is outside ops-scoped summary (legacy / history deep link),
 * keep a chip so the filter stays visible and clearable.
 */
export function ensureActiveTourChipPresent(
  chips: readonly BookingTourChip[],
  active: { readonly tourId: string; readonly tourTitle: string } | null
): BookingTourChip[] {
  const tourId = active?.tourId.trim() ?? "";
  if (tourId.length === 0) {
    return [...chips];
  }
  if (chips.some((chip) => chip.tourId === tourId)) {
    return [...chips];
  }
  const tourTitle = active?.tourTitle.trim() || tourId;
  return [
    {
      tourId,
      tourTitle,
      pendingCount: 0,
      totalCount: 0,
    },
    ...chips,
  ];
}

export function resolveActiveTourChipFallbackTitle(
  items: readonly { readonly tourId: string; readonly tourTitle: string }[],
  tourId: string
): string {
  const id = tourId.trim();
  if (id.length === 0) {
    return "";
  }
  return items.find((item) => item.tourId === id)?.tourTitle.trim() ?? id;
}

/**
 * Pin active tour into the visible set when it would otherwise sit in overflow.
 */
export function partitionBookingTourChips(
  chips: readonly BookingTourChip[],
  options: {
    readonly activeTourId: string;
    readonly maxVisible?: number;
  }
): { readonly visible: BookingTourChip[]; readonly overflow: BookingTourChip[] } {
  const maxVisible = options.maxVisible ?? BOOKINGS_TOUR_CHIP_VISIBLE_MAX;
  if (chips.length <= maxVisible) {
    return { visible: [...chips], overflow: [] };
  }

  const visible = chips.slice(0, maxVisible);
  const overflow = chips.slice(maxVisible);
  const activeTourId = options.activeTourId.trim();
  if (activeTourId.length === 0) {
    return { visible, overflow };
  }

  const overflowIdx = overflow.findIndex((chip) => chip.tourId === activeTourId);
  if (overflowIdx < 0) {
    return { visible, overflow };
  }

  const [active] = overflow.splice(overflowIdx, 1);
  if (active === undefined) {
    return { visible, overflow };
  }
  const displaced = visible.pop();
  visible.push(active);
  if (displaced !== undefined) {
    overflow.unshift(displaced);
  }
  return { visible, overflow };
}
