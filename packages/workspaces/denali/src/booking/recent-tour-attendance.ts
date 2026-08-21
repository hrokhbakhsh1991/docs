/**
 * Phase 3.2 — manual approval + last-N published tour attendance bypass.
 * Pure ranking / parse helpers plus the Denali public-create qualifier.
 */
import {
  WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
  type CanonicalDocument,
} from "@app-tour/workspace-sdk";

import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import type { BookingPublicPort } from "../http/ports/public-booking.port";
import type { DenaliTourStorePort } from "../http/ports/tour-store.port";

export const DENALI_AUTO_APPROVE_MIN_RECENT_TOURS_VALUES = [1, 2, 3] as const;
export type DenaliAutoApproveMinRecentTours =
  (typeof DENALI_AUTO_APPROVE_MIN_RECENT_TOURS_VALUES)[number];

/** Align with host `MAX_MEMBER_BOOKINGS_LIST_CAP` — do not import apps/api. */
export const DENALI_APPROVED_TOUR_HISTORY_SCAN_CAP = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asDataRoot(tourCanonical: unknown): Record<string, unknown> | null {
  if (!isRecord(tourCanonical)) {
    return null;
  }
  const nested = tourCanonical.data;
  if (isRecord(nested)) {
    return nested;
  }
  return tourCanonical;
}

export function parseDenaliAutoApproveMinRecentTours(
  raw: unknown
): DenaliAutoApproveMinRecentTours | null {
  if (raw === 1 || raw === 2 || raw === 3) {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "1" || trimmed === "2" || trimmed === "3") {
      return Number.parseInt(trimmed, 10) as DenaliAutoApproveMinRecentTours;
    }
  }
  return null;
}

export function readDenaliAutoApproveMinRecentToursFromCanonical(
  tourCanonical: unknown
): DenaliAutoApproveMinRecentTours | null {
  const data = asDataRoot(tourCanonical);
  if (data === null) {
    return null;
  }
  const participants = data.participants;
  if (!isRecord(participants)) {
    return null;
  }
  return parseDenaliAutoApproveMinRecentTours(participants.autoApproveMinRecentTours);
}

export function readDenaliTourStartMs(tourCanonical: unknown): number | null {
  const data = asDataRoot(tourCanonical);
  if (data === null) {
    return null;
  }
  const raw = data.startDateTime;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export function selectLastPublishedTourIds(input: {
  readonly tours: readonly { readonly id: string; readonly canonical: CanonicalDocument }[];
  readonly excludeTourId: string;
  readonly beforeStartMs: number;
  readonly take: number;
}): readonly string[] | null {
  if (input.take < 1) {
    return null;
  }
  const ranked: Array<{ readonly id: string; readonly startMs: number }> = [];
  for (const tour of input.tours) {
    if (tour.id === input.excludeTourId) {
      continue;
    }
    if (!isDenaliTourPublished(tour.canonical)) {
      continue;
    }
    const startMs = readDenaliTourStartMs(tour.canonical);
    if (startMs === null || startMs >= input.beforeStartMs) {
      continue;
    }
    ranked.push({ id: tour.id, startMs });
  }
  ranked.sort((left, right) => right.startMs - left.startMs || left.id.localeCompare(right.id));
  if (ranked.length < input.take) {
    return null;
  }
  return ranked.slice(0, input.take).map((row) => row.id);
}

export function guestHasApprovedOnEachTour(
  approvedTourIds: readonly string[],
  requiredTourIds: readonly string[]
): boolean {
  if (requiredTourIds.length === 0) {
    return false;
  }
  const set = new Set(approvedTourIds);
  return requiredTourIds.every((id) => set.has(id));
}

export async function denaliGuestQualifiesForRecentTourBypass(input: {
  readonly tourCanonical: unknown;
  readonly currentTourId: string;
  readonly guestUserId: string;
  readonly registrantTarget: "self" | "other";
  readonly tenantId: string;
  readonly store: DenaliTourStorePort;
  readonly bookingPort: BookingPublicPort;
  readonly nowMs?: number;
}): Promise<boolean> {
  const minRecent = readDenaliAutoApproveMinRecentToursFromCanonical(input.tourCanonical);
  if (minRecent === null) {
    return false;
  }
  if (input.registrantTarget === "other") {
    return false;
  }
  if (input.guestUserId === WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID) {
    return false;
  }
  const listApproved = input.bookingPort.listApprovedTourIdsByGuest;
  if (listApproved === undefined) {
    return false;
  }

  const currentStartMs = readDenaliTourStartMs(input.tourCanonical);
  const beforeStartMs = currentStartMs ?? input.nowMs ?? Date.now();

  const page = await input.store.listPage(
    { tenantId: input.tenantId },
    { limit: Number.MAX_SAFE_INTEGER }
  );
  const requiredTourIds = selectLastPublishedTourIds({
    tours: page.items,
    excludeTourId: input.currentTourId,
    beforeStartMs,
    take: minRecent,
  });
  if (requiredTourIds === null) {
    return false;
  }

  const approvedTourIds = await listApproved(input.tenantId, input.guestUserId);
  return guestHasApprovedOnEachTour(approvedTourIds, requiredTourIds);
}
