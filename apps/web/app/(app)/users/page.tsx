import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { buildUsersListFetchQuery } from "@/features/users/users-directory-list-logic";
import { fetchUsersListServer } from "@/features/users/fetch-users-list.server";
import { isUsersRouteAllowed } from "@/features/users/users-nav-access";
import { parseUsersDirectoryQuery } from "@/features/users/users-directory-types";
import { USERS_OWNERSHIP_TRANSFER_UI_ENABLED } from "@/features/users/users-page-logic";
import { buildUsersPageMetadata } from "@/i18n/app-page-metadata";
import { resolveRequestBootstrapAppSession } from "@/tenant/tenant-kernel";
import { resolveWizardCreateCapability } from "@app-tour/workspace-sdk";

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

  const resolved = await resolveRequestBootstrapAppSession();
  const usersRouteAllowed =
    resolveWizardCreateCapability(resolved.plugin)?.extendedChrome === true ||
    isUsersRouteAllowed(resolved.session.pluginId);
  if (!usersRouteAllowed) {
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
