import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { isUsersRouteAllowed } from "@/features/users/users-nav-access";
import { buildUsersPageMetadata } from "@/i18n/app-page-metadata";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { UsersPageClient } from "./users-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildUsersPageMetadata();
}

export const dynamic = "force-dynamic";

export default async function OperatorUsersPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = resolveBootstrapAppSessionForHost(host);
  if (!isUsersRouteAllowed(resolved.session.pluginId)) {
    notFound();
  }

  return <UsersPageClient session={session} />;
}
