import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { PresetsAdvancedClient } from "./presets-advanced-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("presetsAdvanced");
}

export const dynamic = "force-dynamic";

export default async function TourPresetsAdvancedPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <PresetsAdvancedClient session={session} />;
}
