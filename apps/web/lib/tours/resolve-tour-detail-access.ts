import {
  TOUR_DETAIL_PURCHASED_REGISTRATION_STATUSES,
  type TourDetailAccessLevel,
  type TourDetailViewHints,
} from "@repo/types";

import { bffFetchAuth, readSessionToken } from "@/lib/api/bff-proxy";
import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import { logBffError } from "@/lib/logging/bff-logger";

import { computeTourDetailGpsViewHints } from "./tour-detail-gps-unlock";

export type ResolveTourDetailAccessResult = {
  accessLevel: TourDetailAccessLevel;
  viewHints: TourDetailViewHints;
};

function roleFromJwt(req: Request): string {
  const token = readSessionToken(req);
  if (!token) {
    return "";
  }
  return (decodeJwtPayload(token)?.role ?? "").trim().toLowerCase();
}

function accessLevelFromWorkspaceRole(role: string): TourDetailAccessLevel | null {
  if (role === "owner") {
    return "OWNER";
  }
  if (role === "admin") {
    return "ADMIN";
  }
  if (role === "leader") {
    return "OPERATIONAL";
  }
  return null;
}

function isPurchasedRegistrationRow(
  row: Record<string, unknown>,
  tourId: string,
): boolean {
  const rowTourId = String(row.tourId ?? row.tour_id ?? "").trim();
  if (rowTourId !== tourId) {
    return false;
  }
  const status = String(row.status ?? "").trim();
  return (TOUR_DETAIL_PURCHASED_REGISTRATION_STATUSES as readonly string[]).includes(status);
}

async function hasPurchasedRegistration(req: Request, tourId: string): Promise<boolean> {
  try {
    const res = await bffFetchAuth(req, "/api/v2/bookings");
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      logBffError("tour_detail_bookings_upstream_failed", {
        tourId,
        status: res.status,
        error,
      });
      return false;
    }
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) {
      return false;
    }
    return rows.some(
      (row) =>
        row != null &&
        typeof row === "object" &&
        isPurchasedRegistrationRow(row as Record<string, unknown>, tourId),
    );
  } catch (error) {
    logBffError("tour_detail_bookings_fetch_failed", {
      tourId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function resolveTourDetailAccessLevel(
  req: Request,
  tourId: string,
  tour: Record<string, unknown>,
): Promise<ResolveTourDetailAccessResult> {
  const fromRole = accessLevelFromWorkspaceRole(roleFromJwt(req));
  if (fromRole) {
    return {
      accessLevel: fromRole,
      viewHints: { gpsUnlocked: true, gpsUnlockAt: null },
    };
  }

  const purchased = await hasPurchasedRegistration(req, tourId);
  if (purchased) {
    return {
      accessLevel: "PURCHASED_USER",
      viewHints: computeTourDetailGpsViewHints(tour),
    };
  }

  return {
    accessLevel: "GUEST",
    viewHints: { gpsUnlocked: false, gpsUnlockAt: null },
  };
}
