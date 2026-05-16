import type { BookingDto } from "@repo/types";

import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { normalizeRegistrationPayload } from "@/lib/services/registrations.service";

export type LeaderRegistrationRow = BookingDto & {
  tourTitle: string;
};

export type LeaderDashboardSummary = {
  tour_total: number;
  tour_partial: boolean;
  registration_pending_count: number;
  registration_total_count: number;
};

export async function getLeaderDashboardSummary(): Promise<LeaderDashboardSummary> {
  return bffBrowserClient.get<LeaderDashboardSummary>(BFF.dashboardLeaderSummary);
}

export async function listLeaderRegistrationRows(): Promise<{
  rows: LeaderRegistrationRow[];
  partial: boolean;
}> {
  const raw = await bffBrowserClient.get<{ rows?: unknown[]; partial?: boolean }>(
    BFF.dashboardLeaderRegistrationRows,
  );
  const rows = Array.isArray(raw.rows)
    ? raw.rows.map((row) => {
        const booking = normalizeRegistrationPayload(row);
        const o = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        const tourTitle =
          typeof o.tourTitle === "string"
            ? o.tourTitle
            : typeof o.tour_title === "string"
              ? o.tour_title
              : booking.tourId;
        return { ...booking, tourTitle };
      })
    : [];
  return { rows, partial: raw.partial === true };
}
