"use client";

import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { OPERATOR_WARNING_TEXT_MEDIUM_CLASS } from "@/admin/patterns/operator-semantic-surfaces";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import type { BookingsOpsActionChrome } from "@/features/bookings/bookings-ops-action-chrome";
import { useTourWorkspaceChrome } from "@/features/tours/tour-workspace-chrome-context";
import { formatTourSeats } from "@/features/tours/tour-list-formatters";
import {
  fetchTourDetailCached,
  readCachedTourDetail,
} from "@/features/tours/tour-route-cache";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import {
  buildTourWaitlistCommandCenterHref,
  isTourCapacityFull,
  TOUR_WORKSPACE_WAITLIST_TEST_IDS,
} from "@/features/tours/tour-workspace-waitlist-logic";

import { BookingsPageClient } from "@/features/bookings/bookings-command-center-shell";

type TourWorkspaceWaitlistClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly opsActions: BookingsOpsActionChrome;
};

/**
 * HARDENING H4b — Waitlist tab embeds Bookings CC locked to waitlisted + this tour.
 * Capacity strip remains workspace-owned chrome above the embed.
 */
export function TourWorkspaceWaitlistClient({
  session,
  tourId,
  opsActions,
}: TourWorkspaceWaitlistClientProps) {
  const t = useTranslations("tours.workspace.waitlist");
  const tWorkspace = useTranslations("tours.workspace");
  const tFormat = useTranslations("tours.format");
  const { reloadWorkspaceChrome } = useTourWorkspaceChrome();
  const cached = readCachedTourDetail(tourId);
  const [acceptedCount, setAcceptedCount] = useState(
    cached?.projection.acceptedCount ?? 0
  );
  const [totalCapacity, setTotalCapacity] = useState<number | null>(
    cached?.projection.totalCapacity ?? null
  );

  useEffect(() => {
    let cancelled = false;
    void fetchTourDetailCached(tourId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setAcceptedCount(payload.projection.acceptedCount);
        setTotalCapacity(payload.projection.totalCapacity);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tourId]);

  const capacityLabel =
    totalCapacity !== null
      ? formatTourSeats(
          { acceptedCount, totalCapacity },
          {
            withCapacity: (accepted, capacity) =>
              tFormat("seatsWithCapacity", { accepted, capacity }),
            open: (accepted) => tFormat("seatsOpen", { accepted }),
          }
        )
      : t("capacityOpen");
  const capacityFull = isTourCapacityFull({ acceptedCount, totalCapacity });

  return (
    <div
      className="space-y-4"
      data-testid={TOUR_WORKSPACE_TEST_IDS.waitlistPanel}
      data-operator-surface="card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          <p
            className={
              capacityFull
                ? OPERATOR_WARNING_TEXT_MEDIUM_CLASS
                : "text-sm text-muted-foreground"
            }
            data-testid={TOUR_WORKSPACE_WAITLIST_TEST_IDS.capacity}
          >
            {t("capacityLabel")}: {capacityLabel}
            {capacityFull ? ` — ${t("capacityAtLimit")}` : null}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <OperatorInternalLink href={buildTourWaitlistCommandCenterHref(tourId)}>
            {tWorkspace("openCommandCenter")}
          </OperatorInternalLink>
        </Button>
      </div>
      <BookingsPageClient
        session={session}
        lockedTourId={tourId}
        lockedStatus="waitlisted"
        embedded
        opsActions={opsActions}
        onOpsMutationSuccess={reloadWorkspaceChrome}
        tourCapacityGuard={{ acceptedCount, totalCapacity }}
      />
    </div>
  );
}
