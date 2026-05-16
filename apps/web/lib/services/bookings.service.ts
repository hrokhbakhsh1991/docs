import type { BookingDto } from "@repo/types";

import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";

import { isTourOpsApiConfigured } from "../tour-ops-api-origin";

export function bookingsUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

/**
 * Stable list layout for callers: OpenAPI exposes `GET /api/v2/bookings` as
 * {@link BookingDto[]} only (no query params documented).
 */
export type GetBookingsResult = {
  items: BookingDto[];
  total: number;
  page: number;
  limit: number;
};

export async function getBookings(): Promise<GetBookingsResult> {
  const raw = await bffBrowserClient.get<unknown>(BFF.bookings);
  const items: BookingDto[] = Array.isArray(raw) ? (raw as BookingDto[]) : [];
  const len = items.length;
  const limit = len > 0 ? len : 1;
  return {
    items,
    total: len,
    page: 1,
    limit,
  };
}
