import type { Metadata } from "next";
import { resolveWizardCreateCapability } from "@app-tour/workspace-sdk";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import { buildTourPageMetadata } from "@/i18n/tour-page-metadata";
import { fetchWizardLocationsServer } from "@/tours/fetch-wizard-locations.server";

import { TourEditPageClient } from "./tour-edit-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildTourPageMetadata("edit");
}

export const dynamic = "force-dynamic";

type TourEditPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function TourEditPage({ params }: TourEditPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const workspacePlugin = await loadBootstrapWorkspacePlugin(session.pluginId);
  const extendedChrome = resolveWizardCreateCapability(workspacePlugin)?.extendedChrome === true;
  const { id } = await params;
  const initialLocationsResponse = await fetchWizardLocationsServer();
  return (
    <TourEditPageClient
      session={session}
      tourId={id}
      extendedChrome={extendedChrome}
      initialLocationsResponse={initialLocationsResponse}
    />
  );
}
