import type { Metadata } from "next";

import { TourWorkspaceTransportTab } from "../tour-workspace-transport-tab";
import { TOUR_WORKSPACE_COPY } from "../tour-workspace-copy";

export const metadata: Metadata = {
  title: TOUR_WORKSPACE_COPY.transport.title,
  description: TOUR_WORKSPACE_COPY.transport.description,
};

export default function TourWorkspaceTransportPage() {
  return <TourWorkspaceTransportTab />;
}
