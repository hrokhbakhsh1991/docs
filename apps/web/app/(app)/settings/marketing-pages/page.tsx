import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";
import { getWorkspaceMarketingPagesCapabilities } from "@app-tour/workspace-sdk";

import { MarketingPagesSettingsClient } from "./marketing-pages-settings-client";

export async function generateMetadata() {
  const t = await getTranslations("settings.modules.marketing_pages");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const dynamic = "force-dynamic";

export default async function MarketingPagesSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const bootstrap = await resolveBootstrapAppSessionForHost(host);
  const capabilities = getWorkspaceMarketingPagesCapabilities(bootstrap.session.pluginId);
  if (capabilities?.operatorEditor !== true) {
    notFound();
  }

  return <MarketingPagesSettingsClient session={session} />;
}
