import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchReconciliationTriageServer } from "@/finance/fetch-reconciliation-triage.server";
import { buildSettingsPageMetadata } from "@/i18n/settings-page-metadata";

import { ReconciliationTriageClient } from "./reconciliation-triage-client";

export async function generateMetadata() {
  return buildSettingsPageMetadata("reconciliation");
}

export const dynamic = "force-dynamic";

export default async function ReconciliationTriagePage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const initialFindings = await fetchReconciliationTriageServer();
  return <ReconciliationTriageClient session={session} initialFindings={initialFindings} />;
}
