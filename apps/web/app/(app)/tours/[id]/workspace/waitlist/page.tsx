import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { TourWorkspaceWaitlistClient } from "./tour-workspace-waitlist-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("workspaceWaitlist");
}

export const dynamic = "force-dynamic";

type TourWorkspaceWaitlistPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function TourWorkspaceWaitlistPage({ params }: TourWorkspaceWaitlistPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  return <TourWorkspaceWaitlistClient session={session} tourId={id} />;
}
