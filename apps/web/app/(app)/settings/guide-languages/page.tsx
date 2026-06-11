import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { GuideLanguagesClient } from "./guide-languages-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("guideLanguages");
}

export const dynamic = "force-dynamic";

export default async function GuideLanguagesSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <GuideLanguagesClient session={session} />;
}
