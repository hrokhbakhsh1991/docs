import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchWorkspaceExposureCatalogServer } from "@/exposure/fetch-exposure-catalog.server";
import {
  fetchWorkspaceIntegrationMetaServer,
  fetchWorkspaceIntegrationsServer,
} from "@/integrations/fetch-integrations.server";

import { ExposureSimulationPageClient } from "./exposure-simulation-page-client";

export async function generateMetadata() {
  const t = await getTranslations("settings.exposure.simulation");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const dynamic = "force-dynamic";

export default async function ExposureSimulationPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const [initialList, initialMeta, initialCatalog] = await Promise.all([
    fetchWorkspaceIntegrationsServer(session.workspaceType),
    fetchWorkspaceIntegrationMetaServer(session.workspaceType),
    fetchWorkspaceExposureCatalogServer(session.workspaceType),
  ]);

  return (
    <ExposureSimulationPageClient
      session={session}
      workspaceId={session.workspaceType}
      initialList={initialList}
      initialMeta={initialMeta}
      initialCatalog={initialCatalog}
    />
  );
}
