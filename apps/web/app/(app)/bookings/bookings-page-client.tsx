"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Search, X } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookingActivityTimeline } from "@/admin/patterns/booking-activity-timeline";
import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildBookingsApiQuery,
  filterBulkApprovableIds,
  findSelectedBooking,
  formatBookingDeparture,
  isBulkApprovable,
  isLeaderReviewAlias,
  isTourChipActive,
  parseBookingsCommandCenterQuery,
  readBookingIdFromCommandCenterParams,
  serializeBookingsCommandCenterQuery,
  toggleTourChipFilter,
} from "@/features/bookings/bookings-command-center-logic";
import { BookingRegistrationIntakeDetails } from "@/features/bookings/booking-registration-intake-details";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  BOOKING_STATUS_FILTER_OPTIONS,
  PAYMENT_STATUS_FILTER_OPTIONS,
  isAdminOrOwnerRole,
  resolveBookingsViewForRole,
  type BookingListItem,
  type BookingsCommandCenterQuery,
  type BookingsListResponse,
  type BookingsSummaryResponse,
} from "@/features/bookings/bookings-command-center-types";

import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import { resolveBookingsPageBodyState } from "./bookings-command-center-gate";
import type { BookingsServerPrefetch } from "@/features/bookings/fetch-bookings-list.server";

type BookingsPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly leaderAlias?: boolean;
  readonly initialPrefetch?: BookingsServerPrefetch | null;
};

export function BookingsPageClient({
  session,
  leaderAlias = false,
  initialPrefetch = null,
}: BookingsPageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("bookings");
  const tErrors = useTranslations("bookings.errors");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const parsedQuery = useMemo(
    () => parseBookingsCommandCenterQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const canManageOps = isAdminOrOwnerRole(session.role);
  const query: BookingsCommandCenterQuery = useMemo(
    () => ({
      ...parsedQuery,
      view: resolveBookingsViewForRole(session.role, parsedQuery.view),
      ...(leaderAlias ? { scope: "leader", view: "ops" } : {}),
    }),
    [leaderAlias, parsedQuery, session.role]
  );

  const [searchInput, setSearchInput] = useState(query.search);
  const [listData, setListData] = useState<BookingsListResponse | null>(
    initialPrefetch?.list ?? null
  );
  const [summary, setSummary] = useState<BookingsSummaryResponse | null>(
    initialPrefetch?.summary ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialPrefetch === null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialPrefetch !== null);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const bookingIdFromUrl = readBookingIdFromCommandCenterParams(
      new URLSearchParams(searchParams.toString())
    );
    if (
      bookingIdFromUrl.length > 0 &&
      initialPrefetch?.list.items.some((item) => item.id === bookingIdFromUrl)
    ) {
      return bookingIdFromUrl;
    }
    return initialPrefetch?.list.items[0]?.id ?? null;
  });
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const replaceQuery = (next: BookingsCommandCenterQuery) => {
    const serialized = serializeBookingsCommandCenterQuery(next);
    router.replace(serialized.length > 0 ? `${pathname}?${serialized}` : pathname);
  };

  useEffect(() => {
    setSearchInput(query.search);
  }, [query.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === query.search) {
        return;
      }
      replaceQuery({ ...query, search: searchInput });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [pathname, query, router, searchInput]);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const apiQuery = buildBookingsApiQuery(query);
    const listPromise = fetch(`/api/bookings?${apiQuery}`, { cache: "no-store" });
    const summaryPromise = canManageOps
      ? fetch("/api/bookings/summary", { cache: "no-store" })
      : Promise.resolve(null);

    void Promise.all([listPromise, summaryPromise])
      .then(async ([listRes, summaryRes]) => {
        if (listRes.status === 403) {
          throw new Error("BOOKINGS_OPS_FORBIDDEN");
        }
        if (!listRes.ok) {
          throw new Error(`BOOKINGS_LIST_HTTP_${listRes.status}`);
        }
        const listJson = (await listRes.json()) as BookingsListResponse;
        let summaryJson: BookingsSummaryResponse | null = null;
        if (summaryRes !== null && summaryRes.ok) {
          summaryJson = (await summaryRes.json()) as BookingsSummaryResponse;
        }
        if (!cancelled) {
          setListData(listJson);
          setSummary(summaryJson);
          const bookingIdFromUrl = readBookingIdFromCommandCenterParams(
            new URLSearchParams(searchParams.toString())
          );
          setSelectedId((current) => {
            if (
              bookingIdFromUrl.length > 0 &&
              listJson.items.some((item) => item.id === bookingIdFromUrl)
            ) {
              return bookingIdFromUrl;
            }
            return current ?? listJson.items[0]?.id ?? null;
          });
          setBulkSelectedIds((current) =>
            current.filter((id) => listJson.items.some((item) => item.id === id))
          );
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "BOOKINGS_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManageOps, fetchNonce, query, searchParams]);

  const bodyState = resolveBookingsPageBodyState({
    canManageOps,
    view: query.view,
    loading,
    error,
    itemsLength: listData?.items.length ?? 0,
  });

  const selectedBooking = findSelectedBooking(listData?.items ?? [], selectedId);

  const refreshData = () => {
    setBulkSelectedIds([]);
    setFetchNonce((value) => value + 1);
  };

  const bulkApprovableIds = useMemo(
    () => filterBulkApprovableIds(listData?.items ?? [], bulkSelectedIds),
    [bulkSelectedIds, listData?.items]
  );

  const runBulkApprove = async () => {
    if (bulkApprovableIds.length === 0) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bulkApprovableIds }),
      });
      if (!response.ok) {
        throw new Error(`BOOKINGS_BULK_APPROVE_HTTP_${response.status}`);
      }
      refreshData();
    } catch (bulkError: unknown) {
      setError(bulkError instanceof Error ? bulkError.message : "BOOKINGS_BULK_APPROVE_FAILED");
    } finally {
      setActionBusy(false);
    }
  };

  const toggleBulkSelection = (bookingId: string) => {
    setBulkSelectedIds((current) =>
      current.includes(bookingId)
        ? current.filter((id) => id !== bookingId)
        : [...current, bookingId]
    );
  };

  const runBookingAction = async (action: "approve" | "reject", bookingId: string) => {
    setActionBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({}) : undefined,
      });
      if (!response.ok) {
        throw new Error(`BOOKINGS_${action.toUpperCase()}_HTTP_${response.status}`);
      }
      refreshData();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "BOOKINGS_ACTION_FAILED");
    } finally {
      setActionBusy(false);
    }
  };

  const showLeaderBanner = leaderAlias || isLeaderReviewAlias(query.scope);

  return (
    <div className="space-y-6" data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.page}>
      <PageHeader
        title={showLeaderBanner ? t("leaderReviewTitle") : t("pageTitle")}
        description={t("pageSubtitle")}
        actions={
          canManageOps ? (
            <Button asChild>
              <Link href="/bookings/new">
                <Plus className="me-1 size-4" />
                {t("newRegistration")}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="space-y-1">
        {showLeaderBanner ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.leaderAlias}
          >
            {t("leaderReviewNote")}
          </p>
        ) : null}
      </div>

      {canManageOps && summary !== null ? (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.kpiStrip}
        >
          <KpiCard label={t("kpi.pending")} value={summary.pending} locale={locale} />
          <KpiCard label={t("kpi.approvedToday")} value={summary.approvedToday} locale={locale} />
          <KpiCard label={t("kpi.departures7d")} value={summary.departures7d} locale={locale} />
          <KpiCard label={t("kpi.waitlist")} value={summary.waitlist} locale={locale} />
        </div>
      ) : null}

      {canManageOps && summary !== null && summary.tourChips.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChips}
        >
          <Button
            size="sm"
            variant={query.tourId.length === 0 ? "default" : "outline"}
            onClick={() => replaceQuery({ ...query, tourId: "" })}
          >
            {t("allTours")}
          </Button>
          {summary.tourChips.map((chip) => (
            <Button
              key={chip.tourId}
              size="sm"
              variant={isTourChipActive(query, chip.tourId) ? "default" : "outline"}
              onClick={() => replaceQuery(toggleTourChipFilter(query, chip.tourId))}
            >
              {chip.tourTitle}
              {chip.pendingCount > 0
                ? ` (${formatLocalizedNumber(chip.pendingCount, locale)})`
                : ""}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {BOOKING_STATUS_FILTER_OPTIONS.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={query.status === status ? "default" : "outline"}
              onClick={() => replaceQuery({ ...query, status })}
            >
              {t(`status.${status}`)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {PAYMENT_STATUS_FILTER_OPTIONS.map((paymentStatus) => (
            <Button
              key={paymentStatus}
              size="sm"
              variant={query.paymentStatus === paymentStatus ? "default" : "outline"}
              onClick={() => replaceQuery({ ...query, paymentStatus })}
            >
              {t(`payment.${paymentStatus}`)}
            </Button>
          ))}
        </div>
      </div>

      {canManageOps && bulkApprovableIds.length > 0 ? (
        <div className="flex items-center gap-2">
          <Button
            disabled={actionBusy}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.bulkApproveButton}
            onClick={() => void runBulkApprove()}
          >
            <Check className="me-1 size-4" />
            {t("bulkApprove", { count: bulkApprovableIds.length })}
          </Button>
        </div>
      ) : null}

      {bodyState.type === "locked" ? (
        <Card data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.locked}>
          <CardHeader>
            <CardTitle>{t("lockedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("lockedDescription")}
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "loading" ? (
        <div className="space-y-3">
          <DenaliSkeleton size="block" />
          <DenaliSkeleton size="panel" />
        </div>
      ) : null}

      {bodyState.type === "error" ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {resolveCodedErrorMessage(tErrors, bodyState.message)}
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "empty" ? (
        <Card>
          <CardContent className="pt-6">
            <DenaliEmptyState description={t("emptyFiltered")} icon="trees" />
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "ready" && listData !== null ? (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]" data-density="compact">
          <Card data-denali-bookings-inbox data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox}>
            <CardHeader data-denali-inbox-header>
              <CardTitle>{t("inbox", { count: listData.total })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2" data-denali-booking-list>
              {listData.items.map((item) => (
                <BookingRow
                  key={item.id}
                  item={item}
                  selected={selectedBooking?.id === item.id}
                  bulkChecked={bulkSelectedIds.includes(item.id)}
                  showBulkSelect={canManageOps && isBulkApprovable(item)}
                  onBulkToggle={() => toggleBulkSelection(item.id)}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </CardContent>
          </Card>

          <Card data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection}>
            <CardHeader>
              <CardTitle>{t("inspection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedBooking === null ? (
                <p className="text-sm text-muted-foreground">{t("selectRegistration")}</p>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold">{selectedBooking.guestLabel}</p>
                    <p className="text-sm text-muted-foreground">{selectedBooking.tourTitle}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-muted-foreground">{t("fields.party")}</dt>
                    <dd>{formatLocalizedNumber(selectedBooking.partySize, locale)}</dd>
                    <dt className="text-muted-foreground">{t("fields.departure")}</dt>
                    <dd>{formatBookingDeparture(selectedBooking.departureAt, locale)}</dd>
                    <dt className="text-muted-foreground">{t("fields.payment")}</dt>
                    <dd>{t(`payment.${selectedBooking.paymentStatus}`)}</dd>
                    <dt className="text-muted-foreground">{t("fields.status")}</dt>
                    <dd>
                      <Badge variant={bookingStatusBadgeVariant(selectedBooking.status)}>
                        {t(`status.${selectedBooking.status}`)}
                      </Badge>
                    </dd>
                  </dl>
                  <BookingRegistrationIntakeDetails booking={selectedBooking} />
                  <BookingActivityTimeline booking={selectedBooking} />
                  {canManageOps &&
                  (selectedBooking.status === "pending" ||
                    selectedBooking.status === "waitlisted") ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={actionBusy}
                        data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton}
                        onClick={() => void runBookingAction("reject", selectedBooking.id)}
                      >
                        <X className="me-1 size-4" />
                        {t("reject")}
                      </Button>
                      <Button
                        disabled={actionBusy}
                        data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton}
                        onClick={() => void runBookingAction("approve", selectedBooking.id)}
                      >
                        <Check className="me-1 size-4" />
                        {t("approve")}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function bookingStatusBadgeVariant(status: BookingListItem["status"]): BadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
    case "waitlisted":
      return "warning";
    case "cancelled":
    case "rejected":
      return "destructive";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function KpiCard({
  label,
  value,
  locale,
}: {
  readonly label: string;
  readonly value: number;
  readonly locale: AppLocale;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{formatLocalizedNumber(value, locale)}</p>
      </CardContent>
    </Card>
  );
}

function BookingRow({
  item,
  selected,
  bulkChecked,
  showBulkSelect,
  onBulkToggle,
  onSelect,
}: {
  readonly item: BookingListItem;
  readonly selected: boolean;
  readonly bulkChecked: boolean;
  readonly showBulkSelect: boolean;
  readonly onBulkToggle: () => void;
  readonly onSelect: () => void;
}) {
  const t = useTranslations("bookings");
  const locale = useLocale() as AppLocale;

  return (
    <div
      data-booking-row
      className={`flex items-stretch gap-2 rounded-lg border transition-colors ${
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
      {showBulkSelect ? (
        <label className="flex items-center px-3">
          <Checkbox
            checked={bulkChecked}
            onChange={onBulkToggle}
            aria-label={t("selectGuest", { guest: item.guestLabel })}
          />
        </label>
      ) : null}
      <button type="button" onClick={onSelect} className="flex-1 p-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium">{item.guestLabel}</p>
            <p className="text-xs text-muted-foreground">
              {item.tourTitle} · {formatLocalizedNumber(item.partySize, locale)}p ·{" "}
              {formatBookingDeparture(item.departureAt, locale)}
            </p>
          </div>
          <Badge variant={bookingStatusBadgeVariant(item.status)}>{t(`status.${item.status}`)}</Badge>
        </div>
      </button>
    </div>
  );
}
