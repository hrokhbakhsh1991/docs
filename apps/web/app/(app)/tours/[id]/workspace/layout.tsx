import { Suspense, type ReactNode } from "react";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { resolveBookingOpsCapabilityForHub } from "@/features/bookings/booking-ops-panels";
import { resolveBookingsOpsActionChrome } from "@/features/bookings/bookings-ops-action-chrome";
import { ensureFinanceNavSupported } from "@/finance/finance-nav-enablement";

import { TourWorkspaceLayoutClient } from "./tour-workspace-layout-client";

export const dynamic = "force-dynamic";

type TourWorkspaceLayoutProps = {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
};

export default async function TourWorkspaceLayout({
  children,
  params,
}: TourWorkspaceLayoutProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  const opsManifest = await resolveBookingOpsCapabilityForHub(null, session.pluginId);
  const opsActions = resolveBookingsOpsActionChrome(opsManifest);
  // TW-C-05 — resolve financeNav on the server. Client plugin load cannot see ALLOW_* and
  // would fail-closed-cache the tab away (sidebar Finance still works via app layout ensure).
  const includeFinance = await ensureFinanceNavSupported(session.pluginId);
  return (
    <Suspense fallback={<OperatorSkeleton size="user-card" />}>
      <TourWorkspaceLayoutClient
        session={session}
        tourId={id}
        opsActions={opsActions}
        includeFinance={includeFinance}
      />
      {children}
    </Suspense>
  );
}
