import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { ProfileSettingsClient } from "./profile-settings-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("profile");
}

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <ProfileSettingsClient session={session} />;
}
