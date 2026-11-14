import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchOperatorProfileServer } from "@/features/settings/fetch-operator-profile.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@app-tour/session-client";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";

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
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value ?? "";
  const impersonationReadonly = decodeJwtPayload(token)?.platform_impersonation_readonly === true;
  return (
    <ProfileSettingsClient
      session={session}
      initialProfile={initialProfile}
      impersonationReadonly={impersonationReadonly}
    />
  );
}
