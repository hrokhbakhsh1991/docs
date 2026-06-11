"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export function UsersMemberDetailSheet({
  user,
  open,
  onOpenChange,
}: UsersMemberDetailSheetProps) {
  const t = useTranslations("users");
  const tErrors = useTranslations("users.errors");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<DetailTab>("history");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<UserRoleHistoryResponse | null>(null);
  const [trips, setTrips] = useState<UserBookingSummaryResponse | null>(null);

  useEffect(() => {
    if (!open || user === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHistory(null);
    setTrips(null);

    void (async () => {
      try {
        const [historyRes, tripsRes] = await Promise.all([
          fetch(`/api/users/${user.userId}/role-history`, { cache: "no-store" }),
          fetch(`/api/users/${user.userId}/booking-summary`, { cache: "no-store" }),
        ]);
        if (!historyRes.ok || !tripsRes.ok) {
          throw new Error("USERS_MEMBER_DETAIL_HTTP_ERROR");
        }
        const historyPayload = (await historyRes.json()) as UserRoleHistoryResponse;
        const tripsPayload = (await tripsRes.json()) as UserBookingSummaryResponse;
        if (!cancelled) {
          setHistory(historyPayload);
          setTrips(tripsPayload);
        }
      } catch (detailFailure: unknown) {
        if (!cancelled) {
          setError(
            detailFailure instanceof Error ? detailFailure.message : "USERS_MEMBER_DETAIL_FAILED"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (user === null) {
    return null;
  }

  const resolveRoleLabel = (raw: string): string => {
    if (raw === "ACTIVE" || raw === "SUSPENDED" || raw === "REMOVED") {
      return t(`status.${raw === "REMOVED" ? "removed" : raw === "SUSPENDED" ? "suspended" : "active"}`);
    }
    if (raw === "rewards" || raw === "updated") {
      return raw;
    }
    return t(`roles.${raw}` as "roles.member");
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
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-xl"
        data-testid={USERS_DIRECTORY_TEST_IDS.memberDetail}
      >
        <SheetHeader>
          <SheetTitle>{user.displayName}</SheetTitle>
          <p className="text-sm text-muted-foreground">{user.phone ?? "—"}</p>
        </SheetHeader>

        <div className="mt-4 flex gap-2 border-b pb-2">
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

        {loading ? <p className="mt-4 text-sm text-muted-foreground">{t("memberDetail.loading")}</p> : null}
        {error !== null ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {resolveCodedErrorMessage(tErrors, error)}
          </p>
        ) : null}

        {!loading && error === null && activeTab === "history" ? (
          <div className="mt-4 space-y-3" data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailHistory}>
            {(history?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t("memberDetail.historyEmpty")}</p>
            ) : (
              history?.items.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="rounded-lg border p-3 text-sm">
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

        {!loading && error === null && activeTab === "trips" ? (
          <div className="mt-4 space-y-4" data-testid={USERS_DIRECTORY_TEST_IDS.memberDetailTrips}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{t("memberDetail.totalTrips", { count: trips?.totalTrips ?? 0 })}</Badge>
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
                        status: trip.status,
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
      </SheetContent>
    </Sheet>
  );
}
