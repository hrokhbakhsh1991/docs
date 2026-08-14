"use client";

import { useParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { fetchTourDetailCached } from "@/features/tours/tour-route-cache";

/**
 * Shared `[id]` route shell — warm tour detail cache for edit ↔ workspace hops.
 */
export function TourIdRouteShell({ children }: { readonly children: ReactNode }) {
  const params = useParams();
  const tourId = typeof params?.id === "string" ? params.id.trim() : "";

  useEffect(() => {
    if (tourId.length === 0) {
      return;
    }
    void fetchTourDetailCached(tourId);
  }, [tourId]);

  return children;
}
