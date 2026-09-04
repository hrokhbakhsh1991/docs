"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { PageHeader } from "@/admin/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/routing";

import {
  ENGAGEMENT_OPS_TEST_IDS,
  buildEngagementMemberLookupPath,
  engagementBadgeLabelKey,
  engagementEventTypeLabelKey,
  engagementLevelLabelKey,
  formatEngagementTimestamp,
  validateEngagementMemberUserId,
} from "./engagement-ops-logic";

type OverviewPayload = {
  readonly recentPointEvents: readonly {
    readonly userId: string;
    readonly pointsDelta: number;
    readonly sourceEventType: string;
    readonly createdAt: string;
    readonly displayHint: string | null;
  }[];
  readonly recentBadges: readonly {
    readonly userId: string;
    readonly badgeCode: string;
    readonly labelKey: string;
    readonly earnedAt: string;
    readonly displayHint: string | null;
  }[];
};

type MemberLookupPayload = {
  readonly userId: string;
  readonly summary: {
    readonly totalPoints: number;
    readonly currentLevelCode: string;
    readonly earnedBadgeCount: number;
    readonly badges: readonly {
      readonly code: string;
      readonly earned: boolean;
    }[];
    readonly recentPointEvents: readonly {
      readonly pointsDelta: number;
      readonly sourceEventType: string;
      readonly createdAt: string;
    }[];
  };
};

type LoadState = "idle" | "loading" | "error" | "ready";

export function EngagementOpsPanel() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("engagement.ops");

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [overviewState, setOverviewState] = useState<LoadState>("loading");
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [lookupResult, setLookupResult] = useState<MemberLookupPayload | null>(null);
  const [lookupState, setLookupState] = useState<LoadState>("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const resolveEventLabel = useCallback(
    (sourceEventType: string): string => {
      const key = engagementEventTypeLabelKey(sourceEventType);
      return t.has(key) ? t(key) : sourceEventType;
    },
    [t],
  );

  const resolveBadgeLabel = useCallback(
    (badgeCode: string): string => {
      const key = engagementBadgeLabelKey(badgeCode);
      return t.has(key) ? t(key) : badgeCode;
    },
    [t],
  );

  const resolveLevelLabel = useCallback(
    (levelCode: string): string => {
      const key = engagementLevelLabelKey(levelCode);
      return t.has(key) ? t(key) : levelCode;
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setOverviewState("loading");
      setOverviewError(null);
      try {
        const res = await fetch("/api/engagement/overview", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setOverviewState("error");
            setOverviewError(t("loadFailed"));
          }
          return;
        }
        const payload = (await res.json()) as OverviewPayload;
        if (!cancelled) {
          setOverview(payload);
          setOverviewState("ready");
        }
      } catch {
        if (!cancelled) {
          setOverviewState("error");
          setOverviewError(t("loadFailed"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleMemberLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validated = validateEngagementMemberUserId(searchInput);
    if (!validated.ok) {
      setLookupError(t("memberLookupInvalid"));
      setLookupResult(null);
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch(buildEngagementMemberLookupPath(validated.value), {
        cache: "no-store",
      });
      if (!res.ok) {
        setLookupState("error");
        setLookupError(res.status === 404 ? t("memberLookupNotFound") : t("memberLookupFailed"));
        return;
      }
      const payload = (await res.json()) as MemberLookupPayload;
      setLookupResult(payload);
      setLookupState("ready");
    } catch {
      setLookupState("error");
      setLookupError(t("memberLookupFailed"));
    }
  };

  return (
    <div data-operator-engagement-page data-testid={ENGAGEMENT_OPS_TEST_IDS.page}>
      <PageHeader title={t("title")} description={t("lede")} />

      {overviewState === "error" ? (
        <p role="alert" data-operator-engagement-error className="text-destructive">
          {overviewError}
        </p>
      ) : null}

      {overviewState === "loading" ? (
        <Skeleton className="mb-6 h-40 w-full" data-operator-engagement-loading />
      ) : null}

      {overview !== null && overviewState === "ready" ? (
        <div data-operator-engagement-grid className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card data-operator-engagement-recent-points data-testid={ENGAGEMENT_OPS_TEST_IDS.recentPoints}>
            <CardHeader>
              <CardTitle>{t("recentPoints")}</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.recentPointEvents.length === 0 ? (
                <p data-operator-engagement-empty-points data-testid={ENGAGEMENT_OPS_TEST_IDS.emptyPoints}>
                  {t("emptyPoints")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {overview.recentPointEvents.map((event) => (
                    <li
                      key={`${event.userId}-${event.createdAt}-${event.sourceEventType}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium tabular-nums" dir="ltr">
                          {event.pointsDelta > 0 ? "+" : ""}
                          {event.pointsDelta}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {resolveEventLabel(event.sourceEventType)}
                        </span>
                        {event.displayHint ? (
                          <span className="text-xs text-muted-foreground">{event.displayHint}</span>
                        ) : null}
                      </div>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={event.createdAt}
                      >
                        {formatEngagementTimestamp(event.createdAt, locale)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card
            data-operator-engagement-recent-badges
            data-testid={ENGAGEMENT_OPS_TEST_IDS.recentBadges}
          >
            <CardHeader>
              <CardTitle>{t("recentBadges")}</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.recentBadges.length === 0 ? (
                <p data-operator-engagement-empty-badges data-testid={ENGAGEMENT_OPS_TEST_IDS.emptyBadges}>
                  {t("emptyBadges")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {overview.recentBadges.map((badge) => (
                    <li
                      key={`${badge.userId}-${badge.badgeCode}-${badge.earnedAt}`}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <Badge variant="secondary">{resolveBadgeLabel(badge.badgeCode)}</Badge>
                        {badge.displayHint ? (
                          <span className="text-xs text-muted-foreground">{badge.displayHint}</span>
                        ) : null}
                      </div>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={badge.earnedAt}
                      >
                        {formatEngagementTimestamp(badge.earnedAt, locale)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card data-operator-engagement-member-lookup data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookup}>
        <CardHeader>
          <CardTitle>{t("memberLookupTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => void handleMemberLookup(event)}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="engagement-member-user-id">{t("memberLookupLabel")}</Label>
              <Input
                id="engagement-member-user-id"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("memberLookupPlaceholder")}
                autoComplete="off"
                disabled={lookupState === "loading"}
              />
            </div>
            <Button type="submit" disabled={lookupState === "loading"}>
              {lookupState === "loading" ? t("memberLookupSearching") : t("memberLookupAction")}
            </Button>
          </form>
          {lookupError !== null ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {lookupError}
            </p>
          ) : null}
          {lookupResult !== null && lookupState === "ready" ? (
            <div
              className="mt-4 space-y-3 rounded-md border p-4"
              data-operator-engagement-member-lookup-result
              data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookupResult}
            >
              <p className="text-sm text-muted-foreground">{t("memberLookupResult")}</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("memberLookupPoints")}</dt>
                  <dd className="font-medium tabular-nums" dir="ltr">
                    {lookupResult.summary.totalPoints}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("memberLookupLevel")}</dt>
                  <dd>{resolveLevelLabel(lookupResult.summary.currentLevelCode)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("memberLookupBadges")}</dt>
                  <dd>{lookupResult.summary.earnedBadgeCount}</dd>
                </div>
              </dl>
              {lookupResult.summary.recentPointEvents.length > 0 ? (
                <ul className="space-y-2 border-t pt-3 text-sm">
                  {lookupResult.summary.recentPointEvents.slice(0, 5).map((event, index) => (
                    <li key={`${event.createdAt}-${index}`} className="flex justify-between gap-2">
                      <span>
                        <span className="tabular-nums" dir="ltr">
                          {event.pointsDelta > 0 ? "+" : ""}
                          {event.pointsDelta}
                        </span>{" "}
                        {resolveEventLabel(event.sourceEventType)}
                      </span>
                      <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                        {formatEngagementTimestamp(event.createdAt, locale)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("memberLookupNoHistory")}</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
