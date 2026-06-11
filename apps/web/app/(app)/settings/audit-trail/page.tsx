import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { AuditTrailClient } from "./audit-trail-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("auditTrail");
}

export const dynamic = "force-dynamic";

export default async function AuditTrailSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <AuditTrailClient />;
}
