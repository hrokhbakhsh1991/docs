import { notFound, redirect } from "next/navigation";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { ensureFinanceRouteAllowed } from "@/finance/finance-nav-enablement";
import { hrefForWorkspaceTab } from "@/features/tours/tour-workspace-logic";

type TourWorkspaceFinanceRedirectProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy segment — canonical tab is `?tab=finance`. */
export default async function TourWorkspaceFinanceRedirectPage({
  params,
}: TourWorkspaceFinanceRedirectProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  if (!(await ensureFinanceRouteAllowed(session.pluginId))) {
    notFound();
  }
  const { id } = await params;
  redirect(hrefForWorkspaceTab(id, "finance"));
}
