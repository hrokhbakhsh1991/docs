import type { BookingsSummaryResponse } from "@/features/bookings/bookings-command-center-types";
import type {
  OperatorTourListResponse,
  TourListProjection,
} from "@/features/tours/operator-tours-types";

export const DASHBOARD_WIDGETS_TEST_IDS = {
  overview: "dashboard-widget-stats",
  overviewKpi: "dashboard-overview-kpi-strip",
  tours: "dashboard-widget-tours",
  toursList: "dashboard-tours-recent-list",
  bookings: "dashboard-widget-bookings",
  bookingsKpi: "dashboard-bookings-kpi-strip",
  registrations: "dashboard-widget-registrations",
} as const;

export type DashboardKpiCard = {
  readonly id: string;
  readonly value: number;
};

export function parseDashboardToursList(raw: unknown): OperatorTourListResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [], total: 0, page: 1, limit: 0 };
  }
  const record = raw as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items.filter(isTourListProjection)
    : [];
  return {
    items,
    total: readCount(record.total),
    page: readCount(record.page) || 1,
    limit: readCount(record.limit),
  };
}

export function parseDashboardBookingsSummary(raw: unknown): BookingsSummaryResponse {
  if (raw === null || typeof raw !== "object") {
    return emptyBookingsSummary();
  }
  const record = raw as Record<string, unknown>;
  const tourChips = Array.isArray(record.tourChips)
    ? record.tourChips
        .filter(isBookingTourChip)
        .map((chip) => ({
          tourId: chip.tourId,
          tourTitle: chip.tourTitle,
          pendingCount: readCount(chip.pendingCount),
          totalCount: readCount(chip.totalCount),
        }))
    : [];
  return {
    pending: readCount(record.pending),
    approvedToday: readCount(record.approvedToday),
    departures7d: readCount(record.departures7d),
    waitlist: readCount(record.waitlist),
    tourChips,
  };
}

export function buildDashboardOverviewKpiCards(
  toursTotal: number,
  summary: BookingsSummaryResponse
): readonly DashboardKpiCard[] {
  return [
    { id: "active-tours", value: toursTotal },
    { id: "pending-bookings", value: summary.pending },
    { id: "approved-today", value: summary.approvedToday },
    { id: "departures-7d", value: summary.departures7d },
  ];
}

export function buildDashboardBookingsKpiCards(
  summary: BookingsSummaryResponse
): readonly DashboardKpiCard[] {
  return [
    { id: "pending", value: summary.pending },
    { id: "approved-today", value: summary.approvedToday },
    { id: "departures-7d", value: summary.departures7d },
    { id: "waitlist", value: summary.waitlist },
  ];
}

export function dashboardToursHref(): string {
  return "/tours";
}

export function dashboardBookingsHref(): string {
  return "/bookings";
}

export function dashboardPendingBookingsHref(): string {
  return "/bookings?status=pending";
}

export function dashboardTourWorkspaceHref(tourId: string): string {
  return `/tours/${tourId}/workspace`;
}

export function selectRecentToursForDashboard(
  items: readonly TourListProjection[],
  limit = 3
): readonly TourListProjection[] {
  return items.slice(0, limit);
}

export function selectRegistrationQueueChips(
  summary: BookingsSummaryResponse,
  limit = 3
): BookingsSummaryResponse["tourChips"] {
  return [...summary.tourChips]
    .filter((chip) => chip.pendingCount > 0)
    .sort((left, right) => right.pendingCount - left.pendingCount)
    .slice(0, limit);
}

function emptyBookingsSummary(): BookingsSummaryResponse {
  return {
    pending: 0,
    approvedToday: 0,
    departures7d: 0,
    waitlist: 0,
    tourChips: [],
  };
}

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isTourListProjection(value: unknown): value is TourListProjection {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.title === "string";
}

function isBookingTourChip(value: unknown): value is {
  tourId: string;
  tourTitle: string;
  pendingCount: unknown;
  totalCount: unknown;
} {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.tourId === "string" && typeof record.tourTitle === "string";
}
