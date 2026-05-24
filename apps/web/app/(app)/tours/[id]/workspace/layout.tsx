import type { ReactNode } from "react";

import { TourWorkspaceLayoutClient } from "./tour-workspace-layout-client";

export default function TourWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { id: string };
}) {
  return <TourWorkspaceLayoutClient tourId={params.id}>{children}</TourWorkspaceLayoutClient>;
}
