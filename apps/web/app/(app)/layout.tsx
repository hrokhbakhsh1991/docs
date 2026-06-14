import { headers } from "next/headers";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireOperatorSessionWeb } from "@/admin/require-operator-session";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { OperatorShell } from "@/admin/shell/operator-shell";
import { resolveOperatorNav } from "@/admin/shell/resolve-operator-nav";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveWorkspaceLabelFromMessages } from "@/i18n/resolve-workspace-label";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { isDevWebSessionAllowed } from "@/tenant/auth-env";
import { hasDevHostSmokeSessionProfile } from "@/tenant/dev-host-session-profiles";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

export const dynamic = "force-dynamic";

function normalizeOperatorRole(role: string): OperatorSessionContext["role"] | null {
  if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
    return role;
  }
  return null;
}

export default async function OperatorAppLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const pathname = headerList.get("x-pathname") ?? "/dashboard";
  const bootstrap = resolveBootstrapAppSessionForHost(host);
  const devSmokeHost =
    isDevWebSessionAllowed() && hasDevHostSmokeSessionProfile(host);

  let session = await readOperatorSessionFromCookies();
  if (session === null && devSmokeHost) {
    const ctx = bootstrap.context;
    const role = normalizeOperatorRole(ctx.role);
    if (role !== null) {
      session = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        role,
        workspaceType: bootstrap.session.pluginId,
        pluginId: bootstrap.session.pluginId,
      };
    }
  }

  if (!devSmokeHost) {
    const gate = requireOperatorSessionWeb({ session, pathname, host });
    if (!gate.allowed) {
      redirect(gate.redirectTo);
    }
  } else if (session === null) {
    const returnUrl = encodeURIComponent(pathname);
    redirect(`/auth/login?returnUrl=${returnUrl}`);
  }

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
