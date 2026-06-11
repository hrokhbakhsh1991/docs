import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { TourThemesClient } from "./tour-themes-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("tourThemes");
}

export const dynamic = "force-dynamic";

export default async function TourThemesSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <TourThemesClient session={session} />;
}
