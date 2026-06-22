import { resolveTourOpsApiBaseUrl } from "@/env";

import { buildMemberApiHeaders } from "./build-member-api-headers.server";

export type MemberRegistrationItem = {
  readonly id: string;
  readonly tourTitle: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly submittedAt: string;
};

type BookingsMineResponse = {
  readonly items?: readonly MemberRegistrationItem[];
};

export async function fetchMemberRegistrations(host: string): Promise<MemberRegistrationItem[]> {
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return [];
  }

  const res = await fetch(`${resolveTourOpsApiBaseUrl()}/bookings?view=mine&limit=50`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    return [];
  }

  const payload = (await res.json()) as BookingsMineResponse;
  return [...(payload.items ?? [])];
}
