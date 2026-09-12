import { redirect } from "next/navigation";

import { buildTourWorkspaceBookingsHref } from "@/features/tours/tour-workspace-header-logic";

type TourBookingsAliasPageProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — tour ops bookings live in Command Center (`/bookings?tourId=…`). */
export default async function TourBookingsAliasPage({ params }: TourBookingsAliasPageProps) {
  const { id } = await params;
  const tourId = id.trim();
  if (tourId.length === 0) {
    redirect("/bookings");
  }
  redirect(buildTourWorkspaceBookingsHref(tourId));
}
