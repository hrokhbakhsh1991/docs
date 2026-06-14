import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchWizardLocationsServer } from "@/tours/fetch-wizard-locations.server";
import { fetchWizardTemplateServer } from "@/tours/fetch-wizard-template.server";

import { NewTourWizardClient } from "./new-tour-wizard-client";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("wizard");
  return {
    title: t("pageTitle"),
  };
}

export default async function NewTourPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const [initialTemplateResponse, initialLocationsResponse] = await Promise.all([
    fetchWizardTemplateServer(),
    fetchWizardLocationsServer(),
  ]);

  return (
    <NewTourWizardClient
      initialTemplateResponse={initialTemplateResponse}
      initialLocationsResponse={initialLocationsResponse}
    />
  );
}
