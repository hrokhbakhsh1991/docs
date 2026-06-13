import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchOperatorProfileServer } from "@/features/settings/fetch-operator-profile.server";
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
  const initialProfile = await fetchOperatorProfileServer();
  return <ProfileSettingsClient session={session} initialProfile={initialProfile} />;
}
