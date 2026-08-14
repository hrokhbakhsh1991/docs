import type { ReactNode } from "react";

import { TourIdRouteShell } from "@/features/tours/tour-id-route-shell";

type TourIdLayoutProps = {
  readonly children: ReactNode;
};

/** Shared tour route — warm detail cache for edit ↔ workspace client navigation. */
export default function TourIdLayout({ children }: TourIdLayoutProps) {
  return <TourIdRouteShell>{children}</TourIdRouteShell>;
}
