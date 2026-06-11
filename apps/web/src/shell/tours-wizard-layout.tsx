import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveWorkspaceLabelFromMessages } from "@/i18n/resolve-workspace-label";
import { AppShell } from "@/shell/app-shell";
import { WizardBridgeShell } from "@/shell/wizard-bridge-shell";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

const DENALI_PLUGIN_ID = "denali";

/** `/tours/*` — Denali operators get Wizard Bridge; others keep Phase 3 AppShell. */
export async function ToursWizardLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = resolveBootstrapAppSessionForHost(host);
  const pluginId = resolved.session.pluginId;
  const session = await readOperatorSessionFromCookies();

  if (session !== null && pluginId === DENALI_PLUGIN_ID) {
    const tWorkspaces = await getTranslations("app.workspaces");
    const workspaceLabel = resolveWorkspaceLabelFromMessages(tWorkspaces, pluginId);
    const tenantTheme = await fetchTenantThemeForContext(resolved.context, host);
    return (
      <WizardBridgeShell
        workspaceLabel={workspaceLabel}
        displayName={tenantTheme?.displayName ?? null}
        pluginId={pluginId}
      >
        {children}
      </WizardBridgeShell>
    );
  }

  return <AppShell pluginId={pluginId}>{children}</AppShell>;
}
