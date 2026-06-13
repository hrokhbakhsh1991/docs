import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchTenantBrandingServer } from "@/features/settings/fetch-tenant-branding.server";
import { getTranslations } from "next-intl/server";

import { BrandingSettingsClient } from "./branding-settings-client";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";
import { headers } from "next/headers";

export async function generateMetadata() {
  const t = await getTranslations("settings.modules.workspace_branding");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const host = (await headers()).get("host") ?? "localhost:3000";
  const bootstrap = resolveBootstrapAppSessionForHost(host);
  const initialBranding = await fetchTenantBrandingServer();

  return (
    <BrandingSettingsClient
      session={session}
      pluginId={bootstrap.session.pluginId}
      initialBranding={initialBranding}
    />
  );
}
