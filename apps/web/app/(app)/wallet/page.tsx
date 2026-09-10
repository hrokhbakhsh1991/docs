import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { ensureWalletRouteAllowed } from "@/wallet/wallet-nav-enablement";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { WalletOpsCenter } from "./wallet-ops-center";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wallet.ops");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  const tenantTheme = await fetchTenantThemeForContext(resolved.context, host);
  if (!(await ensureWalletRouteAllowed(resolved.session.pluginId, tenantTheme))) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <WalletOpsCenter session={session} />
    </Suspense>
  );
}
