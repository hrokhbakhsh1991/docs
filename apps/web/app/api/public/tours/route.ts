import { NextResponse } from "next/server";

import { proxyBffGetPublic } from "@/lib/api/bff-proxy";
import { mapTourResponseToDto } from "@/lib/mappers/tour.mapper";

type PaginatedBody = {
  items?: unknown[];
  total?: number;
  page?: number;
  limit?: number;
};

/** Public OPEN-tour catalog (`status=completed` on Nest list API). */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const params = new URLSearchParams(url.searchParams);
  if (!params.has("status")) {
    params.set("status", "completed");
  }
  if (!params.has("limit")) {
    params.set("limit", "24");
  }
  const qs = params.toString();
  const upstream = await proxyBffGetPublic(req, `/api/v2/tours?${qs}`);
  if (!upstream.ok) {
    return upstream;
  }
  const raw = (await upstream.json()) as PaginatedBody;
  const rows = Array.isArray(raw.items) ? raw.items : [];
  const openOnly = rows
    .map((row) => mapTourResponseToDto(row))
    .filter((tour) => tour.lifecycleStatus === "OPEN");
  return NextResponse.json({
    items: openOnly,
    total: openOnly.length,
    page: raw.page ?? 1,
    limit: raw.limit ?? openOnly.length,
    accessLevel: "GUEST",
  });
}
