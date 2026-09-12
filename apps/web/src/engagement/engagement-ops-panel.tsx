"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/admin/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/routing";

import { EngagementAuditTab } from "./engagement-ops-audit-tab";
import { EngagementAwardRulesTab } from "./engagement-ops-award-rules-tab";
import { EngagementBadgesTab } from "./engagement-ops-badges-tab";
import { EngagementLevelsTab } from "./engagement-ops-levels-tab";
import {
  ENGAGEMENT_OPS_TABS,
  ENGAGEMENT_OPS_TEST_IDS,
  engagementBadgeLabelKey,
  engagementEventTypeLabelKey,
  formatEngagementTimestamp,
  type EngagementOpsTab,
} from "./engagement-ops-logic";
import type { OverviewPayload } from "./engagement-ops-types";
import { engagementTabButtonClass } from "./engagement-ops-ui-primitives";

type LoadState = "idle" | "loading" | "error" | "ready";

const TAB_TEST_IDS: Record<EngagementOpsTab, string> = {
  overview: ENGAGEMENT_OPS_TEST_IDS.tabOverview,
  badges: ENGAGEMENT_OPS_TEST_IDS.tabBadges,
  levels: ENGAGEMENT_OPS_TEST_IDS.tabLevels,
  awardRules: ENGAGEMENT_OPS_TEST_IDS.tabAwardRules,
  audit: ENGAGEMENT_OPS_TEST_IDS.tabAudit,
};

export function EngagementOpsPanel() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("engagement.ops");

  const [activeTab, setActiveTab] = useState<EngagementOpsTab>("overview");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [overviewState, setOverviewState] = useState<LoadState>("loading");
  const [overviewError, setOverviewError] = useState<string | null>(null);

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
            setOverviewError(
              res.status === 403 ? t("permissionDenied") : t("loadFailed"),
            );
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

  return (
    <div data-operator-engagement-page data-testid={ENGAGEMENT_OPS_TEST_IDS.page}>
      <PageHeader title={t("title")} description={t("lede")} />

      <nav
        data-operator-engagement-tabs
        data-testid={ENGAGEMENT_OPS_TEST_IDS.tabs}
        className="mb-6 flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
        aria-label={t("tabsAria")}
      >
        {ENGAGEMENT_OPS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            data-tab={tab}
            data-testid={TAB_TEST_IDS[tab]}
            aria-current={activeTab === tab ? "page" : undefined}
            className={engagementTabButtonClass(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <>
          {overviewState === "error" ? (
            <p role="alert" data-operator-engagement-error className="mb-6 text-destructive">
              {overviewError}
            </p>
          ) : null}

          {overviewState === "loading" ? (
            <Skeleton className="mb-6 h-40 w-full" data-operator-engagement-loading />
          ) : null}

          {overview !== null && overviewState === "ready" ? (
            <>
              <Card className="mb-6 border-dashed" data-operator-engagement-member-ops-hint>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">{t("memberOpsUsersHint")}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/users" data-testid={ENGAGEMENT_OPS_TEST_IDS.memberOpsUsersLink}>
                      {t("memberOpsUsersAction")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <div data-operator-engagement-grid className="mb-6 grid gap-6 lg:grid-cols-2">
              <Card
                data-operator-engagement-recent-points
                data-testid={ENGAGEMENT_OPS_TEST_IDS.recentPoints}
              >
                <CardHeader>
                  <CardTitle>{t("recentPoints")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {overview.recentPointEvents.length === 0 ? (
                    <p
                      data-operator-engagement-empty-points
                      data-testid={ENGAGEMENT_OPS_TEST_IDS.emptyPoints}
                    >
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
                    <p
                      data-operator-engagement-empty-badges
                      data-testid={ENGAGEMENT_OPS_TEST_IDS.emptyBadges}
                    >
                      {t("emptyBadges")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {overview.recentBadges.map((badge) => (
                        <li
                          key={`${badge.userId}-${badge.badgeCode}-${badge.earnedAt}`}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                        >
                          <Badge variant="secondary">{resolveBadgeLabel(badge.badgeCode)}</Badge>
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
            </>
          ) : null}
        </>
      ) : null}

      {activeTab === "badges" ? <EngagementBadgesTab active /> : null}
      {activeTab === "levels" ? <EngagementLevelsTab active /> : null}
      {activeTab === "awardRules" ? <EngagementAwardRulesTab active /> : null}
      {activeTab === "audit" ? <EngagementAuditTab active /> : null}
    </div>
  );
}
