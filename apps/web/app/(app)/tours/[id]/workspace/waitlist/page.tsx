import type { Metadata } from "next";

import { TourWorkspaceWaitlistTab } from "../tour-workspace-waitlist-tab";
import { TOUR_WORKSPACE_COPY } from "../tour-workspace-copy";

export const metadata: Metadata = {
  title: TOUR_WORKSPACE_COPY.waitlist.title,
  description: TOUR_WORKSPACE_COPY.metadata.description,
};

export default function TourWorkspaceWaitlistPage() {
  return <TourWorkspaceWaitlistTab />;
}
