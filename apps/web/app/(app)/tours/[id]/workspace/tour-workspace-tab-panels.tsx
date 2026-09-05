"use client";

import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import type { BookingsOpsActionChrome } from "@/features/bookings/bookings-ops-action-chrome";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { TourWorkspaceFinanceClient } from "@/features/tours/tour-workspace-finance-client";
import type { TourWorkspaceSubnavTab } from "@/features/tours/tour-workspace-types";
import type { InTourOpsPanels } from "@/features/tours/in-tour-ops-enablement";
import { TourWorkspaceOperationsClient } from "@/features/tours/tour-workspace-operations-client";
import { TourWorkspaceRegistrationsClient } from "./tour-workspace-registrations-client";
import { TourWorkspaceTransportClient } from "./transport/tour-workspace-transport-client";
import { TourWorkspaceWaitlistClient } from "./waitlist/tour-workspace-waitlist-client";

type TourWorkspaceTabPanelsProps = {
  readonly activeTab: TourWorkspaceSubnavTab;
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly opsActions: BookingsOpsActionChrome;
  readonly includeFinance: boolean;
  readonly inTourOpsPanels: InTourOpsPanels;
  readonly detail: OperatorTourDetailResponse | null;
};

function useLazyMountedTabs(
  activeTab: TourWorkspaceSubnavTab
): ReadonlySet<TourWorkspaceSubnavTab> {
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<TourWorkspaceSubnavTab>>(
    () => new Set([activeTab])
  );

  useEffect(() => {
    setMountedTabs((current) => {
      if (current.has(activeTab)) {
        return current;
      }
      const next = new Set(current);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return mountedTabs;
}

/**
 * Lazy keep-alive tab panels — mount on first visit, then toggle visibility only.
 */
export function TourWorkspaceTabPanels({
  activeTab,
  session,
  tourId,
  opsActions,
  includeFinance,
  inTourOpsPanels,
  detail,
}: TourWorkspaceTabPanelsProps) {
  const mountedTabs = useLazyMountedTabs(activeTab);

  return (
    <>
      {mountedTabs.has("operations") ? (
        <div hidden={activeTab !== "operations"} aria-hidden={activeTab !== "operations"}>
          <TourWorkspaceOperationsClient
            session={session}
            tourId={tourId}
            panels={inTourOpsPanels}
          />
        </div>
      ) : null}
      {mountedTabs.has("registrations") ? (
        <div hidden={activeTab !== "registrations"} aria-hidden={activeTab !== "registrations"}>
          <TourWorkspaceRegistrationsClient
            session={session}
            tourId={tourId}
            opsActions={opsActions}
            detail={detail}
          />
        </div>
      ) : null}
      {mountedTabs.has("waitlist") ? (
        <div hidden={activeTab !== "waitlist"} aria-hidden={activeTab !== "waitlist"}>
          <TourWorkspaceWaitlistClient
            session={session}
            tourId={tourId}
            opsActions={opsActions}
          />
        </div>
      ) : null}
      {mountedTabs.has("transport") ? (
        <div hidden={activeTab !== "transport"} aria-hidden={activeTab !== "transport"}>
          <TourWorkspaceTransportClient tourId={tourId} pluginId={session.pluginId} />
        </div>
      ) : null}
      {includeFinance && mountedTabs.has("finance") ? (
        <div hidden={activeTab !== "finance"} aria-hidden={activeTab !== "finance"}>
          <TourWorkspaceFinanceClient session={session} tourId={tourId} />
        </div>
      ) : null}
    </>
  );
}
