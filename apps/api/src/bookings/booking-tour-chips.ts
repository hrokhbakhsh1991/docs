/**
 * Ops tour-chip membership for GET /bookings/summary (BOOKINGS-OPS-UX §11.10 P4a/P4c).
 * Pure helpers — Prisma and in-memory repositories must share this predicate.
 */

export type BookingTourChipScope = "ops" | "all";

export type BookingTourChipStats = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly pendingCount: number;
  readonly totalCount: number;
};

export type BookingTourChipDraft = BookingTourChipStats & {
  /** True when any registration for this tour has departureAt >= summary clock.now. */
  readonly hasUpcomingDeparture: boolean;
  /** Waitlisted regs on this tour (ops signal only — stripped from public DTO). */
  readonly waitlistedCount: number;
};

/** UX-BKG-28 — pending ∪ waitlisted ∪ upcoming; drop pure-history tours. */
export function isOpsBookingTourChip(chip: {
  readonly pendingCount: number;
  readonly waitlistedCount: number;
  readonly hasUpcomingDeparture: boolean;
}): boolean {
  return chip.pendingCount > 0 || chip.waitlistedCount > 0 || chip.hasUpcomingDeparture;
}

export function compareBookingTourChips(
  left: BookingTourChipStats,
  right: BookingTourChipStats
): number {
  return (
    right.pendingCount - left.pendingCount ||
    right.totalCount - left.totalCount ||
    left.tourTitle.localeCompare(right.tourTitle)
  );
}

/**
 * Filter by scope, strip internal flags, sort for chip bar / finance consumers.
 * `ops` (default) = P4a predicate; `all` = every tour with registrations (P4c escape).
 */
export function finalizeBookingTourChips(
  drafts: readonly BookingTourChipDraft[],
  scope: BookingTourChipScope = "ops"
): BookingTourChipStats[] {
  const selected = scope === "all" ? drafts : drafts.filter(isOpsBookingTourChip);
  const byTourId = new Map<string, BookingTourChipStats>();
  for (const { tourId, tourTitle, pendingCount, totalCount } of selected) {
    const existing = byTourId.get(tourId);
    if (existing === undefined) {
      byTourId.set(tourId, { tourId, tourTitle, pendingCount, totalCount });
      continue;
    }
    byTourId.set(tourId, {
      tourId,
      tourTitle: existing.tourTitle,
      pendingCount: existing.pendingCount + pendingCount,
      totalCount: existing.totalCount + totalCount,
    });
  }
  return [...byTourId.values()].sort(compareBookingTourChips);
}

/** @deprecated Prefer finalizeBookingTourChips(..., "ops") — kept for call-site clarity. */
export function finalizeOpsBookingTourChips(
  drafts: readonly BookingTourChipDraft[]
): BookingTourChipStats[] {
  return finalizeBookingTourChips(drafts, "ops");
}
