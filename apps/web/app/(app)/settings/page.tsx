import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { SettingsHubClient } from "./settings-hub-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("hub");
}

export const dynamic = "force-dynamic";

export default function OperatorSettingsPage() {
  return <SettingsHubClient />;
}
