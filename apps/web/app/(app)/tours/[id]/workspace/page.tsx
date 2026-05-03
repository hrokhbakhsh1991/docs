import type { Metadata } from "next";

import { TourWorkspaceClient } from "./tour-workspace-client";

export const metadata: Metadata = {
  title: "Tour registrations workspace",
};

export default function TourWorkspacePage({ params }: { params: { id: string } }) {
  return <TourWorkspaceClient tourId={params.id} />;
}
