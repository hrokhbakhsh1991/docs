import type { Metadata } from "next";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";

import { TourWorkspaceRegistrationsClient } from "./tour-workspace-registrations-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("workspace");
}

export const dynamic = "force-dynamic";

type TourWorkspaceRegistrationsPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function TourWorkspaceRegistrationsPage({
  params,
}: TourWorkspaceRegistrationsPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  return <TourWorkspaceRegistrationsClient tourId={id} />;
}
