import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { TourPresetsClient } from "./tour-presets-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("tourPresets");
}

export const dynamic = "force-dynamic";

export default async function TourPresetsSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <TourPresetsClient session={session} />;
}
