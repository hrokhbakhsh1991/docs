import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchSettingsModulesServer } from "@/features/settings/fetch-settings-modules.server";
import { WizardAccessDenied } from "@/wizard/wizard-access-denied";

import { SettingsHubClient } from "./settings-hub-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("hub");
}

export const dynamic = "force-dynamic";

export default async function OperatorSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null || session.pluginId.trim().length === 0) {
    return <WizardAccessDenied />;
  }
  const initialModules = await fetchSettingsModulesServer();
  return (
    <SettingsHubClient initialModules={initialModules} pluginId={session.pluginId} />
  );
}
