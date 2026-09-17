import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { ensureEngagementRouteAllowed } from "@/engagement/engagement-nav-enablement";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { EngagementOpsCenter } from "./engagement-ops-center";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("engagement.ops");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function EngagementPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  if (!(await ensureEngagementRouteAllowed(resolved.session.pluginId))) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <EngagementOpsCenter />
    </Suspense>
  );
}
