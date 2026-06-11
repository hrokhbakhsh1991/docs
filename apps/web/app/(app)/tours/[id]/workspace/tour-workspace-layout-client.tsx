"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import {
  hrefForWorkspaceTab,
  resolveWorkspaceSubnavTab,
  TOUR_WORKSPACE_SUBNAV_TABS,
} from "@/features/tours/tour-workspace-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

import { TourStatusBadge } from "../../tour-status-badge";

type TourWorkspaceLayoutClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly children: ReactNode;
};

export function TourWorkspaceLayoutClient({
  session: _session,
  tourId,
  children,
}: TourWorkspaceLayoutClientProps) {
  const t = useTranslations("tours.workspace");
  const tErrors = useTranslations("tours.workspace.errors");
  const tNav = useTranslations("tours.nav");
  const pathname = usePathname() ?? "";
  const activeTab = resolveWorkspaceSubnavTab(pathname, tourId);
  const [detail, setDetail] = useState<OperatorTourDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/tours/${encodeURIComponent(tourId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOUR_WORKSPACE_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorTourDetailResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_WORKSPACE_FETCH_FAILED");
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
  }, [tourId]);

  const localizedError = resolveTourErrorMessage(tErrors, error);

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid={TOUR_WORKSPACE_TEST_IDS.page}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/tours">
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {tNav("tours")}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(tourId)}/edit`}>
          <Button type="button" variant="outline" size="sm">
            {tNav("editTour")}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(tourId)}/register`}>
          <Button type="button" variant="default" size="sm">
            {tNav("registerGuest")}
          </Button>
        </Link>
      </div>

      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
      {localizedError !== null ? <p className="text-sm text-destructive">{localizedError}</p> : null}

      {!loading && detail !== null ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader className="space-y-2">
            <TourStatusBadge status={detail.projection.uiStatus} />
            <CardTitle className="text-2xl">{detail.projection.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("title")}</p>
          </CardHeader>
        </Card>
      ) : null}

      <nav
        className="flex flex-wrap gap-2 border-b pb-2"
        aria-label={t("subnavAria")}
        data-testid={TOUR_WORKSPACE_TEST_IDS.subnav}
      >
        {TOUR_WORKSPACE_SUBNAV_TABS.map(({ tab, testId }) => {
          const href = hrefForWorkspaceTab(tourId, tab);
          const isActive = activeTab === tab;
          return (
            <Link
              key={tab}
              href={href}
              prefetch={false}
              data-testid={testId}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
              }
            >
              {t(`tabs.${tab}`)}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
