import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { WizardDraftsSettingsClient } from "./wizard-drafts-settings-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("wizardDrafts");
}

export const dynamic = "force-dynamic";

export default async function WizardDraftsSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <WizardDraftsSettingsClient />;
}
