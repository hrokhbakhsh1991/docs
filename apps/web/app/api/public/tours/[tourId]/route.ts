import { NextResponse } from "next/server";

import { proxyBffGetPublic } from "@/lib/api/bff-proxy";
import { mergeRegistrationPolicyIntoTour } from "@/lib/tours/registration-policy";
import {
  buildTourDetailViewForAccess,
  GUEST_HINTS,
} from "@/features/tours/domain/tour-detail-redaction";

type RouteContext = { params: { tourId: string } };

/** Removes finance/location fields not cleared by guest redaction (e.g. top-level cost_context). */
function stripPublicTourSensitiveFields(tour: Record<string, unknown>): void {
  delete tour.costContext;
  delete tour.cost_context;
  delete tour.meetingPoint;
  delete tour.meeting_point;
}

/** Public tour detail — always guest-redacted before JSON response. */
export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { tourId } = context.params;
  const upstream = await proxyBffGetPublic(req, `/api/v2/tours/${encodeURIComponent(tourId)}`);
  if (!upstream.ok) {
    return upstream;
  }
  const tourRaw = (await upstream.json()) as Record<string, unknown>;
  const lifecycle = String(tourRaw.lifecycleStatus ?? tourRaw.lifecycle_status ?? "")
    .trim()
    .toUpperCase();
  if (lifecycle !== "OPEN") {
    return NextResponse.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Tour is not open for public booking",
        },
      },
      { status: 404 },
    );
  }
  const tour = buildTourDetailViewForAccess(tourRaw, "GUEST", GUEST_HINTS);
  stripPublicTourSensitiveFields(tour);
  mergeRegistrationPolicyIntoTour(tour);
  return NextResponse.json({
    ...tour,
    accessLevel: "GUEST",
    viewHints: GUEST_HINTS,
  });
}
