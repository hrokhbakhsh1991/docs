import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveWorkspaceLabelFromMessages } from "@/i18n/resolve-workspace-label";
import { AppShell } from "@/shell/app-shell";
import { WizardBridgeShell } from "@/shell/wizard-bridge-shell";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { resolveBootstrapAppSessionForHostAsync } from "@/tenant/tenant-kernel";
import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";
import { ensureWizardCreate } from "@/workspace/wizard-create-registry";

/**
 * `/tours/*` — workspaces with `wizardCreate.extendedChrome` get Wizard Bridge;
 * others keep Phase 3 AppShell (Wave D.c — no hard-coded pluginId).
 */
export async function ToursWizardLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHostAsync(host);
  const pluginId = resolved.session.pluginId;
  const session = await readOperatorSessionFromCookies();

  await ensureWizardCreate(pluginId);

  if (session !== null && isExtendedOperatorWorkspace(pluginId)) {
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
