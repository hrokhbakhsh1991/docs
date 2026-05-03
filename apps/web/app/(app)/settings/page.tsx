import type { Metadata } from "next";

import { SettingsPageClient } from "./settings-page-client";

export const metadata: Metadata = {
  title: "Settings",
  description: "Workspace profile and notification preferences.",
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
