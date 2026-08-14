/**
 * Tour workspace header KPI helpers — TOURS-WORKSPACE-COMPLETE + HARDENING H-01…H-03.
 * @see docs/phase-9/appendices/TOURS-WORKSPACE-COMPLETE.md §3
 * @see docs/phase-9/appendices/TOURS-WORKSPACE-UX-HARDENING-PLAN.md
 */
import type { TourListProjection } from "@/features/tours/operator-tours-types";
import { hrefForWorkspaceTab } from "@/features/tours/tour-workspace-logic";
import type { TourWorkspaceSubnavTab } from "@/features/tours/tour-workspace-types";

export type TourWorkspaceOpsCounts = {
  readonly pending: number;
  readonly waitlisted: number;
  readonly approved: number;
};

export type TourWorkspaceOpsCountsLoadResult =
  | { readonly ok: true; readonly counts: TourWorkspaceOpsCounts }
  | { readonly ok: false; readonly errorCode: string };

export function buildTourWorkspaceBookingsHref(tourId: string): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  params.set("view", "ops");
  return `/bookings?${params.toString()}`;
}

export function buildTourWorkspaceFinanceHref(tourId: string): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  return `/finance?${params.toString()}`;
}

export function buildTourWorkspaceOpsCountsQuery(tourId: string, status: string): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  params.set("status", status);
  params.set("view", "ops");
  params.set("limit", "1");
  return params.toString();
}

/** H-02 — approved KPI navigates to transport (day-of roster). */
export function hrefForWorkspaceOpsKpi(
  tourId: string,
  kpi: keyof TourWorkspaceOpsCounts
): string {
  const tab: TourWorkspaceSubnavTab =
    kpi === "waitlisted" ? "waitlist" : kpi === "approved" ? "transport" : "registrations";
  return hrefForWorkspaceTab(tourId, tab);
}

export function hrefForWorkspaceMoneyKpi(tourId: string): string {
  return hrefForWorkspaceTab(tourId, "finance");
}

/** UX-BKG-56 / H-08 — deep link to CC history filter for reject/cancel records. */
export function buildTourWorkspaceHistoryHref(
  tourId: string,
  status: "rejected" | "cancelled"
): string {
  const params = new URLSearchParams();
  params.set("tourId", tourId.trim());
  params.set("status", status);
  params.set("view", "ops");
  return `/bookings?${params.toString()}`;
}

export function formatTourWorkspaceCapacity(
  projection: Pick<TourListProjection, "acceptedCount" | "totalCapacity">
): { readonly accepted: number; readonly capacity: number | null } {
  return {
    accepted: projection.acceptedCount,
    capacity: projection.totalCapacity,
  };
}

export function readBookingsListTotal(payload: unknown): number | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const total = (payload as { total?: unknown }).total;
  if (typeof total !== "number" || !Number.isFinite(total)) {
    return null;
  }
  return Math.max(0, Math.trunc(total));
}

/**
 * H-01 — build ops counts from three list payloads. Any missing/invalid total ⇒ fail
 * (caller must not paint silent zeros).
 */
export function resolveTourWorkspaceOpsCountsFromListPayloads(input: {
  readonly pendingPayload: unknown;
  readonly waitlistedPayload: unknown;
  readonly approvedPayload: unknown;
}): TourWorkspaceOpsCountsLoadResult {
  const pending = readBookingsListTotal(input.pendingPayload);
  const waitlisted = readBookingsListTotal(input.waitlistedPayload);
  const approved = readBookingsListTotal(input.approvedPayload);
  if (pending === null || waitlisted === null || approved === null) {
    return { ok: false, errorCode: "TOUR_WORKSPACE_OPS_COUNTS_INVALID" };
  }
  return {
    ok: true,
    counts: { pending, waitlisted, approved },
  };
}
