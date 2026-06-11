import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { EquipmentSettingsClient } from "./equipment-settings-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("equipment");
}

export const dynamic = "force-dynamic";

export default async function EquipmentSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <EquipmentSettingsClient session={session} />;
}
