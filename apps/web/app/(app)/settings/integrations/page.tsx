import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import {
  fetchWorkspaceIntegrationMetaServer,
  fetchWorkspaceIntegrationsServer,
} from "@/integrations/fetch-integrations.server";
import { fetchWorkspaceExposureCatalogServer } from "@/exposure/fetch-exposure-catalog.server";

import { IntegrationsSettingsClient } from "./integrations-settings-client";

export async function generateMetadata() {
  const t = await getTranslations("settings.modules.integrations");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
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
    <IntegrationsSettingsClient
      session={session}
      workspaceId={session.workspaceType}
      initialList={initialList}
      initialMeta={initialMeta}
      initialCatalog={initialCatalog}
    />
  );
}
