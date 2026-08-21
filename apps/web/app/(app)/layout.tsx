import { headers, cookies } from "next/headers";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  requireOperatorSessionWeb,
  type OperatorSessionContext,
} from "@/admin/require-operator-session";
import { OperatorShell } from "@/admin/shell/operator-shell";
import { ensureFinanceNavSupported } from "@/finance/finance-nav-enablement";
import { ensureWizardCreate } from "@/workspace/wizard-create-registry";
import { resolveOperatorNav } from "@/admin/shell/resolve-operator-nav";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { decodeJwtPayload } from "@app-tour/session-client";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveWorkspaceLabelFromMessages } from "@/i18n/resolve-workspace-label";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { isDevWebSessionAllowed } from "@/tenant/auth-env";
import { hasDevHostSmokeSessionProfile } from "@/tenant/dev-host-session-profiles";
import { resolveRequestBootstrapAppSession } from "@/tenant/tenant-kernel";
import { fetchOperatorProfileServer } from "@/features/settings/fetch-operator-profile.server";
import {
  resolveTenantBrandingDisplayName,
  type TenantDefaultLocale,
} from "@app-tour/workspace-sdk";

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
  // Authenticated operator shell: JWT tenant → pluginId (not host guest / env starter fallback).
  // Anonymous path inside helper still uses host bootstrap unchanged.
  const bootstrap = await resolveRequestBootstrapAppSession();
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
  const operatorProfile = await fetchOperatorProfileServer();
  const locale = (await getLocale()) === "fa" ? "fa" : "en";
  const tWorkspaces = await getTranslations("app.workspaces");
  await ensureFinanceNavSupported(bootstrap.session.pluginId);
  const wizardCreate = await ensureWizardCreate(bootstrap.session.pluginId);
  const navItems = resolveOperatorNav({
    session: session!,
    pluginId: bootstrap.session.pluginId,
  });

  const cookieStore = await cookies();
  const rawSession = cookieStore.get(SESSION_TOKEN_COOKIE)?.value ?? "";
  const impersonationReadonly =
    decodeJwtPayload(rawSession)?.platform_impersonation_readonly === true;
  const workspaceLabel = resolveWorkspaceLabelFromMessages(
    tWorkspaces,
    bootstrap.session.pluginId
  );
  const displayName = resolveTenantBrandingDisplayName(
    tenantTheme ?? {},
    locale as TenantDefaultLocale,
    workspaceLabel
  );

  return (
    <OperatorShell
      session={session!}
      workspaceLabel={workspaceLabel}
      displayName={displayName}
      operatorProfileDisplayName={operatorProfile?.displayName ?? null}
      operatorProfileAvatarUrl={operatorProfile?.avatarUrl ?? null}
      pluginId={bootstrap.session.pluginId}
      wizardCreate={wizardCreate}
      navItems={navItems}
      impersonationReadonly={impersonationReadonly}
    >
      {children}
    </OperatorShell>
  );
}
