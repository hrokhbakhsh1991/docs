import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { TourWorkspaceTransportClient } from "./tour-workspace-transport-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("workspaceTransport");
}

export const dynamic = "force-dynamic";

type TourWorkspaceTransportPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function TourWorkspaceTransportPage({
  params,
}: TourWorkspaceTransportPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  return <TourWorkspaceTransportClient tourId={id} />;
}
