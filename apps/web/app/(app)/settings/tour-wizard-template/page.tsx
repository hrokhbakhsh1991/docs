import { headers } from "next/headers";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";
import { fetchWizardTemplateServer } from "@/tours/fetch-wizard-template.server";
import { buildWizardTemplateCatalogFromPlugin } from "@/tours/wizard-template-catalog-logic";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { WizardTemplateClient } from "./wizard-template-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("wizardTemplate");
}

export const dynamic = "force-dynamic";

export default async function TourWizardTemplatePage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const host = (await headers()).get("host") ?? "localhost:3000";
  const bootstrap = resolveBootstrapAppSessionForHost(host);
  const [initialTemplateResponse, initialCatalog] = await Promise.all([
    fetchWizardTemplateServer(),
    Promise.resolve(buildWizardTemplateCatalogFromPlugin(bootstrap.plugin)),
  ]);

  return (
    <WizardTemplateClient
      session={session}
      pluginId={bootstrap.session.pluginId}
      initialTemplateResponse={initialTemplateResponse}
      initialCatalog={initialCatalog}
    />
  );
}
