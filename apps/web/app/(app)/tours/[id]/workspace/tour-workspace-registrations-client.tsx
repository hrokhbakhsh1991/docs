"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import type { BookingsOpsActionChrome } from "@/features/bookings/bookings-ops-action-chrome";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { useTourWorkspaceChrome } from "@/features/tours/tour-workspace-chrome-context";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";

import { BookingsPageClient } from "@/features/bookings/bookings-command-center-shell";

const TourWorkspaceAdminRegistrationLauncher = dynamic(
  () =>
    import("./tour-workspace-admin-registration-launcher").then(
      (module) => module.TourWorkspaceAdminRegistrationLauncher
    ),
  { ssr: false }
);

type TourWorkspaceRegistrationsClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly opsActions: BookingsOpsActionChrome;
  readonly detail: OperatorTourDetailResponse | null;
};

/**
 * Registrations tab — embeds Bookings Command Center locked to this tour (TW-C-01).
 * Primary Register CTA lives on workspace header only (HARDENING H-06).
 * @see docs/phase-9/appendices/TOURS-WORKSPACE-COMPLETE.md §6
 */
export function TourWorkspaceRegistrationsClient({
  session,
  tourId,
  opsActions,
  detail,
}: TourWorkspaceRegistrationsClientProps) {
  const t = useTranslations("tours.workspace.registrations");
  const { reloadWorkspaceChrome } = useTourWorkspaceChrome();
  const canManage = isAdminOrOwnerRole(session.role);

  return (
    <div
      className="space-y-4"
      data-testid={TOUR_WORKSPACE_TEST_IDS.registrationsPanel}
      data-operator-surface="card"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {canManage ? (
          <TourWorkspaceAdminRegistrationLauncher
            label={t("adminCreateCta")}
            session={session}
            tourId={tourId}
            detail={detail}
            onCreated={reloadWorkspaceChrome}
          />
        ) : null}
      </div>
      <BookingsPageClient
        session={session}
        lockedTourId={tourId}
        embedded
        opsActions={opsActions}
        onOpsMutationSuccess={reloadWorkspaceChrome}
      />
    </div>
  );
}
