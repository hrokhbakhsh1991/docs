import type { BookingDto } from "@repo/types";

import { apiClient } from "../api-client";
import { API } from "../api-paths";

export function bookingsUseLiveApi(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
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
  const raw = await apiClient.get<unknown>(API.bookings);
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
