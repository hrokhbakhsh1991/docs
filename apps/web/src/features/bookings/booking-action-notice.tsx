"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  buildBookingsHistoryHref,
  type BookingActionNoticeModel,
} from "@/features/bookings/bookings-command-center-logic";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";
import { TourInternalLink, OperatorInternalLink } from "@/features/tours/tour-internal-link";
import {
  useTourWorkspaceChrome,
  type NavigateWorkspaceTabOptions,
} from "@/features/tours/tour-workspace-chrome-context";
import { buildTourWorkspaceHistoryHref } from "@/features/tours/tour-workspace-header-logic";
import { hrefForWorkspaceTab } from "@/features/tours/tour-workspace-logic";
import type { TourWorkspaceSubnavTab } from "@/features/tours/tour-workspace-types";

type BookingActionNoticeProps = {
  readonly notice: BookingActionNoticeModel;
  readonly lockedTourId?: string;
};

const tabLinkClassName = "font-medium text-primary underline-offset-4 hover:underline";

function WorkspaceTabActionLink({
  tab,
  href,
  testId,
  navigateOptions,
  children,
}: {
  readonly tab: TourWorkspaceSubnavTab;
  readonly href: string;
  readonly testId: string;
  readonly navigateOptions?: NavigateWorkspaceTabOptions;
  readonly children: ReactNode;
}) {
  const { navigateWorkspaceTab } = useTourWorkspaceChrome();

  if (navigateWorkspaceTab !== null) {
    return (
      <button
        type="button"
        className={tabLinkClassName}
        data-testid={testId}
        onClick={() => navigateWorkspaceTab(tab, navigateOptions)}
      >
        {children}
      </button>
    );
  }

  return (
    <TourInternalLink href={href} className={tabLinkClassName} data-testid={testId}>
      {children}
    </TourInternalLink>
  );
}

/** UX-BKG-56 — lifecycle success banner with optional workspace / history links. */
export function BookingActionNotice({ notice, lockedTourId }: BookingActionNoticeProps) {
  const t = useTranslations("bookings.actionNotice");

  if (notice.kind !== "lifecycle") {
    return null;
  }

  const {
    action,
    guestLabel,
    embeddedTourId,
    showFinanceLink,
    historyStatus,
    registrationId,
  } = notice;
  const tourId = embeddedTourId ?? lockedTourId?.trim() ?? "";

  const message =
    action === "approve"
      ? showFinanceLink === true
        ? t("approveUnpaid", { guest: guestLabel })
        : t("approve", { guest: guestLabel })
      : action === "reject"
        ? t("reject", { guest: guestLabel })
        : action === "cancel"
          ? t("cancel", { guest: guestLabel })
          : t("waitlist", { guest: guestLabel });

  const transportHref =
    tourId.length > 0 ? hrefForWorkspaceTab(tourId, "transport") : null;
  const financeHref =
    tourId.length > 0
      ? hrefForWorkspaceTab(tourId, "finance", {
          focusRegistrationId: registrationId,
        })
      : null;
  const waitlistHref = tourId.length > 0 ? hrefForWorkspaceTab(tourId, "waitlist") : null;
  const historyHref =
    historyStatus !== undefined
      ? tourId.length > 0
        ? buildTourWorkspaceHistoryHref(tourId, historyStatus)
        : buildBookingsHistoryHref({ tourId: lockedTourId, status: historyStatus })
      : null;

  const showEmbeddedLinks =
    embeddedTourId !== undefined &&
    (action === "approve" || action === "waitlist" || historyStatus !== undefined);

  return (
    <div
      className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice}
      role="status"
    >
      <p>{message}</p>
      {showEmbeddedLinks ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {action === "approve" && transportHref !== null ? (
            <>
              <span className="text-muted-foreground">{t("embeddedHint")}</span>
              <WorkspaceTabActionLink
                tab="transport"
                href={transportHref}
                testId={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeTransportLink}
              >
                {t("viewTransport")}
              </WorkspaceTabActionLink>
              {showFinanceLink === true && financeHref !== null ? (
                <>
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <WorkspaceTabActionLink
                    tab="finance"
                    href={financeHref}
                    navigateOptions={{ focusRegistrationId: registrationId }}
                    testId={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeFinanceLink}
                  >
                    {t("viewFinance")}
                  </WorkspaceTabActionLink>
                </>
              ) : null}
            </>
          ) : null}
          {action === "waitlist" && waitlistHref !== null ? (
            <>
              <span className="text-muted-foreground">{t("embeddedHint")}</span>
              <WorkspaceTabActionLink
                tab="waitlist"
                href={waitlistHref}
                testId={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeWaitlistLink}
              >
                {t("viewWaitlist")}
              </WorkspaceTabActionLink>
            </>
          ) : null}
          {historyStatus !== undefined && historyHref !== null ? (
            <OperatorInternalLink
              href={historyHref}
              className={tabLinkClassName}
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeHistoryLink}
            >
              {t("viewHistory")}
            </OperatorInternalLink>
          ) : null}
        </p>
      ) : null}
      {!showEmbeddedLinks && historyStatus !== undefined && historyHref !== null ? (
        <p className="mt-1 text-xs">
          <OperatorInternalLink
            href={historyHref}
            className={tabLinkClassName}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNoticeHistoryLink}
          >
            {t("viewHistory")}
          </OperatorInternalLink>
        </p>
      ) : null}
    </div>
  );
}
