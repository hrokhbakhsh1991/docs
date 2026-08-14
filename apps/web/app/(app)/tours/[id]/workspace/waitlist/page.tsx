import { redirect } from "next/navigation";

import { hrefForWorkspaceTab } from "@/features/tours/tour-workspace-logic";

type TourWorkspaceWaitlistRedirectProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — canonical tab is `?tab=waitlist`. */
export default async function TourWorkspaceWaitlistRedirectPage({
  params,
}: TourWorkspaceWaitlistRedirectProps) {
  const { id } = await params;
  redirect(hrefForWorkspaceTab(id, "waitlist"));
}
