import { redirect } from "next/navigation";

import { hrefForWorkspaceTab } from "@/features/tours/tour-workspace-logic";

type TourWorkspaceTransportRedirectProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — canonical tab is `?tab=transport`. */
export default async function TourWorkspaceTransportRedirectPage({
  params,
}: TourWorkspaceTransportRedirectProps) {
  const { id } = await params;
  redirect(hrefForWorkspaceTab(id, "transport"));
}
