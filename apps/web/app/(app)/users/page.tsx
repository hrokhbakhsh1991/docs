import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildUsersListFetchQuery } from "@/features/users/users-directory-list-logic";
import { fetchUsersListServer } from "@/features/users/fetch-users-list.server";
import { isUsersRouteAllowed } from "@/features/users/users-nav-access";
import { parseUsersDirectoryQuery } from "@/features/users/users-directory-types";
import { USERS_OWNERSHIP_TRANSFER_UI_ENABLED } from "@/features/users/users-page-logic";
import { buildUsersPageMetadata } from "@/i18n/app-page-metadata";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { UsersPageClient } from "./users-page-client";

export async function generateMetadata(): Promise<Metadata> {
  return buildUsersPageMetadata();
}

export const dynamic = "force-dynamic";

type OperatorUsersPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toUrlSearchParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        next.append(key, entry);
      }
    } else {
      next.set(key, value);
    }
  }
  return next;
}

export default async function OperatorUsersPage({ searchParams }: OperatorUsersPageProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  if (!isUsersRouteAllowed(resolved.session.pluginId)) {
    notFound();
  }

  const params = await searchParams;
  const query = parseUsersDirectoryQuery(toUrlSearchParams(params));
  const initialUsersList =
    query.tab === "pending"
      ? null
      : await fetchUsersListServer(buildUsersListFetchQuery(query));
  const initialOwnershipRoster =
    USERS_OWNERSHIP_TRANSFER_UI_ENABLED && session.role === "owner"
      ? await fetchUsersListServer("limit=100&sort=name_asc")
      : null;

  return (
    <UsersPageClient
      session={session}
      initialUsersList={initialUsersList}
      initialOwnershipRoster={initialOwnershipRoster}
    />
  );
}
