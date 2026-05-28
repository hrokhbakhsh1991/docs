import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors/app-error";
import { bffFetchAuth, bffFetchWithInternalKey, proxyBffPatch, readSessionToken } from "@/lib/api/bff-proxy";
import {
  mergeResolvedGearIntoTour,
  mergeResolvedThemesIntoTour,
  parseCatalogJson,
} from "@/lib/api/tour-catalog-aggregation";
import { mergeRegistrationPolicyIntoTour } from "@/lib/tours/registration-policy";
import { buildTourDetailViewForAccess } from "@/lib/tours/tour-detail-redaction";
import { resolveTourDetailAccessLevel } from "@/lib/tours/resolve-tour-detail-access";
import { logBffError } from "@/lib/logging/bff-logger";

type RouteContext = { params: { tourId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  if (!readSessionToken(req)) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { tourId } = context.params;

  try {
    const tourRes = await bffFetchAuth(req, `/api/v2/tours/${encodeURIComponent(tourId)}`);
    if (!tourRes.ok) {
      const error = await tourRes.json().catch(() => ({}));
      return NextResponse.json(error, { status: tourRes.status });
    }
    const tourRaw = (await tourRes.json()) as Record<string, unknown>;

    const { accessLevel, viewHints } = await resolveTourDetailAccessLevel(req, tourId, tourRaw);
    const tour = buildTourDetailViewForAccess(tourRaw, accessLevel, viewHints);

    let equipmentCatalog = null;
    let themesCatalog = null;

    try {
      const [equipmentRes, themesRes] = await Promise.all([
        bffFetchWithInternalKey(req, "/api/v2/settings/equipment"),
        bffFetchWithInternalKey(req, "/api/v2/settings/tour-themes"),
      ]);

      if (!equipmentRes.ok) {
        const equipmentError = await equipmentRes.json().catch(() => ({}));
        logBffError("tour_aggregate_equipment_upstream_failed", {
          tourId,
          status: equipmentRes.status,
          error: equipmentError,
        });
      } else {
        equipmentCatalog = await parseCatalogJson(equipmentRes);
      }

      if (!themesRes.ok) {
        const themesError = await themesRes.json().catch(() => ({}));
        logBffError("tour_aggregate_themes_upstream_failed", {
          tourId,
          status: themesRes.status,
          error: themesError,
        });
      } else {
        themesCatalog = await parseCatalogJson(themesRes);
      }
    } catch (catalogError) {
      logBffError("tour_aggregate_catalog_fetch_failed", {
        tourId,
        message: catalogError instanceof Error ? catalogError.message : String(catalogError),
      });
    }

    mergeResolvedGearIntoTour(tour, equipmentCatalog, { tourId, catalog: "equipment" });
    mergeResolvedThemesIntoTour(tour, themesCatalog, { tourId });
    mergeRegistrationPolicyIntoTour(tour);

    return NextResponse.json({
      ...tour,
      accessLevel,
      viewHints,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTH_SESSION_INVALID") {
      return NextResponse.json(
        { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to aggregate tour data" } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  if (!readSessionToken(req)) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }
  const { tourId } = context.params;
  return proxyBffPatch(req, `/api/v2/tours/${encodeURIComponent(tourId)}`);
}
