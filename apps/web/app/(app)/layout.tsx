import { headers } from "next/headers";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireOperatorSessionWeb } from "@/admin/require-operator-session";
import { OperatorShell } from "@/admin/shell/operator-shell";
import { resolveOperatorNav } from "@/admin/shell/resolve-operator-nav";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveWorkspaceLabelFromMessages } from "@/i18n/resolve-workspace-label";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

export const dynamic = "force-dynamic";

export default async function OperatorAppLayout({ children }: { children: ReactNode }) {
  const session = await readOperatorSessionFromCookies();
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const pathname = headerList.get("x-pathname") ?? "/dashboard";
  const gate = requireOperatorSessionWeb({ session, pathname, host });
  if (!gate.allowed) {
    redirect(gate.redirectTo);
  }

  const bootstrap = resolveBootstrapAppSessionForHost(host);
  const tenantTheme = await fetchTenantThemeForContext(bootstrap.context, host);
  const tWorkspaces = await getTranslations("app.workspaces");
  const navItems = resolveOperatorNav({
    session: session!,
    pluginId: bootstrap.session.pluginId,
  });

  return (
    <OperatorShell
      session={session!}
      workspaceLabel={resolveWorkspaceLabelFromMessages(tWorkspaces, bootstrap.session.pluginId)}
      displayName={tenantTheme?.displayName ?? null}
      pluginId={bootstrap.session.pluginId}
      navItems={navItems}
    >
      {children}
    </OperatorShell>
  );
}
