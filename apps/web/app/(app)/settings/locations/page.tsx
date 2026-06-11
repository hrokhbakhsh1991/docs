import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { LocationsSettingsClient } from "./locations-settings-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("locations");
}

export const dynamic = "force-dynamic";

export default async function LocationsSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <LocationsSettingsClient session={session} />;
}
