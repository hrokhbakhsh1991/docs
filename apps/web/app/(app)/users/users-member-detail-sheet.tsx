"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  USERS_DIRECTORY_TEST_IDS,
  type MembershipAuditEventKind,
  type UserBookingSummaryResponse,
  type UserRoleHistoryItem,
  type UserRoleHistoryResponse,
  type UsersDirectoryRow,
} from "@/features/users/users-directory-types";

type DetailTab = "history" | "trips";

type UsersMemberDetailSheetProps = {
  readonly user: UsersDirectoryRow | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function UsersMemberDetailSheet({ user, open, onOpenChange }: UsersMemberDetailSheetProps) {
  const t = useTranslations("users");
  const tBookingsStatus = useTranslations("bookings.status");
  const tErrors = useTranslations("users.errors");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<DetailTab>("history");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [history, setHistory] = useState<UserRoleHistoryResponse | null>(null);
  const [trips, setTrips] = useState<UserBookingSummaryResponse | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadMemberDetail = useCallback(async (userId: string, signal: { cancelled: boolean }) => {
    setHistoryLoading(true);
    setTripsLoading(true);
    setHistoryError(null);
    setTripsError(null);
    setHistory(null);
    setTrips(null);

    const loadHistory = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/users/${userId}/role-history`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("USERS_MEMBER_DETAIL_HTTP_ERROR");
        }
        const payload = (await response.json()) as UserRoleHistoryResponse;
        if (!signal.cancelled) {
          setHistory(payload);
        }
      } catch (loadFailure: unknown) {
        if (!signal.cancelled) {
          setHistoryError(
            loadFailure instanceof Error ? loadFailure.message : "USERS_MEMBER_DETAIL_FAILED"
          );
        }
      } finally {
        if (!signal.cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    const loadTrips = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/users/${userId}/booking-summary`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("USERS_MEMBER_DETAIL_HTTP_ERROR");
        }
        const payload = (await response.json()) as UserBookingSummaryResponse;
        if (!signal.cancelled) {
          setTrips(payload);
        }
      } catch (loadFailure: unknown) {
        if (!signal.cancelled) {
          setTripsError(
            loadFailure instanceof Error ? loadFailure.message : "USERS_MEMBER_DETAIL_FAILED"
          );
        }
      } finally {
        if (!signal.cancelled) {
          setTripsLoading(false);
        }
      }
    };

    await Promise.all([loadHistory(), loadTrips()]);
  }, []);

  useEffect(() => {
    if (!open || user === null) {
      return;
    }
    const signal = { cancelled: false };
    void loadMemberDetail(user.userId, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [open, user, reloadToken, loadMemberDetail]);

  const retryLoad = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  if (user === null) {
    return null;
  }

  const resolveRoleLabel = (raw: string): string => {
    if (raw === "ACTIVE" || raw === "SUSPENDED" || raw === "REMOVED") {
      return t(
        `status.${raw === "REMOVED" ? "removed" : raw === "SUSPENDED" ? "suspended" : "active"}`
      );
    }
    if (raw === "rewards") {
      return t("memberDetail.eventLabels.rewards");
    }
    if (raw === "updated") {
      return t("memberDetail.eventLabels.updated");
    }
    return t(`roles.${raw}` as "roles.member");
  };

  const resolveTripStatusLabel = (status: string): string => {
    const known = ["pending", "approved", "waitlisted", "rejected", "cancelled"] as const;
    if ((known as readonly string[]).includes(status)) {
      return tBookingsStatus(status);
    }
    return status;
  };

  const resolveHistorySummary = (entry: UserRoleHistoryItem): string => {
    const kind: MembershipAuditEventKind = entry.eventKind ?? "role_change";
    if (kind === "status_change") {
      return t("memberDetail.statusChange", {
        previous: resolveRoleLabel(entry.oldRole),
        next: resolveRoleLabel(entry.newRole),
      });
    }
    if (kind === "rewards_change") {
      return t("memberDetail.rewardsChange");
    }
    if (kind === "member_removed") {
      return t("memberDetail.memberRemoved", { role: resolveRoleLabel(entry.oldRole) });
    }
    return t("memberDetail.roleChange", {
      oldRole: resolveRoleLabel(entry.oldRole),
      newRole: resolveRoleLabel(entry.newRole),
    });
  };

  const formatWhen = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      date
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0"
        data-testid={USERS_DIRECTORY_TEST_IDS.memberDetail}
      >
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle>{user.displayName}</DialogTitle>
          <DialogDescription>{user.phone ?? "—"}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 gap-2 border-b px-6 py-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "history" ? "default" : "ghost"}
            onClick={() => setActiveTab("history")}
          >
            {t("memberDetail.tabs.history")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "trips" ? "default" : "ghost"}
            onClick={() => setActiveTab("trips")}
          >
            {t("memberDetail.tabs.trips")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "history" && historyLoading ? (
            <Skeleton
              className="h-32 w-full rounded-lg"
              data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailLoading}
            />
          ) : null}
          {activeTab === "trips" && tripsLoading ? (
            <Skeleton
              className="h-32 w-full rounded-lg"
              data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailLoading}
            />
          ) : null}

          {activeTab === "history" && historyError !== null ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">
                {resolveCodedErrorMessage(tErrors, historyError)}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={retryLoad}>
                {t("memberDetail.retry")}
              </Button>
            </div>
          ) : null}

          {activeTab === "trips" && tripsError !== null ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">
                {resolveCodedErrorMessage(tErrors, tripsError)}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={retryLoad}>
                {t("memberDetail.retry")}
              </Button>
            </div>
          ) : null}

          {!historyLoading && historyError === null && activeTab === "history" ? (
            <div className="space-y-3" data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailHistory}>
              {(history?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t("memberDetail.historyEmpty")}</p>
              ) : (
                history?.items.map((entry, index) => (
                  <div
                    key={`${entry.createdAt}-${index}`}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <p className="font-medium">{resolveHistorySummary(entry)}</p>
                    <p className="text-muted-foreground">
                      {t("memberDetail.byActor", { actor: entry.actorMobile })}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatWhen(entry.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {!tripsLoading && tripsError === null && activeTab === "trips" ? (
            <div className="space-y-4" data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailTrips}>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {t("memberDetail.totalTrips", { count: trips?.totalTrips ?? 0 })}
                </Badge>
                <Badge variant="outline">
                  {t("memberDetail.completedTrips", { count: trips?.completedTrips ?? 0 })}
                </Badge>
                <Badge variant="outline">
                  {t("memberDetail.cancelledTrips", { count: trips?.cancelledTrips ?? 0 })}
                </Badge>
              </div>
              {(trips?.trips.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t("memberDetail.tripsEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {trips?.trips.map((trip) => (
                    <li key={trip.bookingId} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{trip.tourTitle}</p>
                      <p className="text-muted-foreground">
                        {t("memberDetail.tripMeta", {
                          status: resolveTripStatusLabel(trip.status),
                          partySize: trip.partySize,
                          departure: formatWhen(trip.departureAt),
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
