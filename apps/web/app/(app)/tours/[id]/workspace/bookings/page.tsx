import { redirect } from "next/navigation";

import { buildTourWorkspaceBookingsHref } from "@/features/tours/tour-workspace-header-logic";

type TourWorkspaceBookingsAliasPageProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — workspace tabs use `?tab=`; ops bookings escape to Command Center. */
export default async function TourWorkspaceBookingsAliasPage({
  params,
}: TourWorkspaceBookingsAliasPageProps) {
  const { id } = await params;
  const tourId = id.trim();
  if (tourId.length === 0) {
    redirect("/bookings");
  }
  redirect(buildTourWorkspaceBookingsHref(tourId));
}
