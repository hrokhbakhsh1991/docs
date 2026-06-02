"use client";

import type { TourDetailAccessLevel } from "@repo/types";
import type { ReactNode } from "react";

import { hasMinTourDetailAccess } from "@/lib/tours/tour-detail-access-ui";

export type AccessGateProps = {
  accessLevel: TourDetailAccessLevel;
  minLevel: TourDetailAccessLevel | TourDetailAccessLevel[];
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Declarative visibility gate for tour detail sections by BFF-resolved {@link accessLevel}.
 */
export function AccessGate({ accessLevel, minLevel, children, fallback = null }: AccessGateProps) {
  if (!hasMinTourDetailAccess(accessLevel, minLevel)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
