import type { Metadata } from "next";

import { TourWorkspaceClient } from "./tour-workspace-client";
import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";

export const metadata: Metadata = {
  title: TOUR_WORKSPACE_COPY.metadata.title,
  description: TOUR_WORKSPACE_COPY.metadata.description,
};

export default function TourWorkspacePage({ params }: { params: { id: string } }) {
  return <TourWorkspaceClient tourId={params.id} />;
}
