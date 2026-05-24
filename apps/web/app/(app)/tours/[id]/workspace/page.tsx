import type { Metadata } from "next";

import { TourWorkspaceRegistrationsTab } from "./tour-workspace-registrations-tab";
import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";

export const metadata: Metadata = {
  title: TOUR_WORKSPACE_COPY.registrations.title,
  description: TOUR_WORKSPACE_COPY.metadata.description,
};

export default function TourWorkspaceRegistrationsPage() {
  return <TourWorkspaceRegistrationsTab />;
}
