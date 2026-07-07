"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { isExtendedOperatorSession, type OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildTourTitlePatch,
  canMutateTour,
} from "@/features/tours/build-tour-title-patch";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "@/features/tours/tour-list-formatters";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import { DenaliWizardCatalogPrefetchProvider } from "@/wizard/denali/denali-wizard-catalog-prefetch-context";

import { DenaliFlatEditPageClient } from "./denali-flat-edit-page-client";
import { TourStatusBadge } from "../../tour-status-badge";

type TourEditPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly initialLocationsResponse?: unknown | null;
};

export function TourEditPageClient({
  session,
  tourId,
  initialLocationsResponse = null,
}: TourEditPageClientProps) {
  const useFlatEditShell = isExtendedOperatorSession(session);
  const canEdit = canMutateTour(session.role);
  if (useFlatEditShell && canEdit) {
    return (
      <DenaliWizardCatalogPrefetchProvider initialLocationsResponse={initialLocationsResponse}>
        <DenaliFlatEditPageClient session={session} tourId={tourId} />
      </DenaliWizardCatalogPrefetchProvider>
    );
  }
  return <TourEditTitlePageClient session={session} tourId={tourId} />;
}

function TourEditTitlePageClient({ session, tourId }: TourEditPageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.edit");
  const tErrors = useTranslations("tours.edit.errors");
  const tNav = useTranslations("tours.nav");
  const tFormat = useTranslations("tours.format");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [detail, setDetail] = useState<OperatorTourDetailResponse | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);

  const canEdit = canMutateTour(session.role);
  const localizedError = resolveTourErrorMessage(tErrors, error);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}`, {
        cache: "no-store",
      });
      if (response.status === 404) {
        setDetail(null);
        setError("TOUR_NOT_FOUND");
        return;
      }
      if (!response.ok) {
        throw new Error(`TOUR_EDIT_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as OperatorTourDetailResponse;
      setDetail(payload);
      setTitle(payload.projection.title);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "TOUR_EDIT_LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, fetchNonce]);

  const handleSave = async () => {
    if (!canEdit || detail === null) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patchBody = buildTourTitlePatch(detail, title);
      const response = await fetch(`/api/tours/${encodeURIComponent(tourId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!response.ok) {
        throw new Error(`TOUR_EDIT_PATCH_${response.status}`);
      }
      router.refresh();
      setFetchNonce((value) => value + 1);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "TOUR_EDIT_SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" data-testid={TOUR_EDIT_TEST_IDS.page}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error === "TOUR_NOT_FOUND" || detail === null) {
    return (
      <Card data-denali-surface="card" data-testid={TOUR_EDIT_TEST_IDS.page} className="shadow-sm">
        <CardContent className="py-10 text-center text-muted-foreground">
          {t("notFound")}
          <div className="mt-4">
            <Link href="/tours">
              <Button variant="outline" size="sm">
                {tNav("backToTours")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priceLabel = formatTourPrice(
    detail.projection.priceAmount,
    detail.projection.priceCurrency,
    locale
  );
  const departureLabel = formatTourDeparture(detail.projection.departureAt, locale);
  const seatsLabel = formatTourSeats(detail.projection, {
    withCapacity: (accepted, capacity) =>
      tFormat("seatsWithCapacity", { accepted, capacity }),
    open: (accepted) => tFormat("seatsOpen", { accepted }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-testid={TOUR_EDIT_TEST_IDS.page}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/tours">
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {tNav("tours")}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(tourId)}/workspace`}>
          <Button type="button" variant="outline" size="sm" data-testid={TOUR_EDIT_TEST_IDS.workspace}>
            {tNav("workspace")}
          </Button>
        </Link>
        {canEdit ? (
          <Link href={`/tours/${encodeURIComponent(tourId)}/register`}>
            <Button type="button" variant="default" size="sm" data-testid={TOUR_EDIT_TEST_IDS.register}>
              {tNav("registerGuest")}
            </Button>
          </Link>
        ) : null}
      </div>

      <Card data-denali-surface="card" className="shadow-sm">
        <CardHeader className="space-y-3">
          <TourStatusBadge status={detail.projection.uiStatus} />
          <CardTitle className="text-2xl">{detail.projection.title}</CardTitle>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {departureLabel ? <span>{departureLabel}</span> : null}
            {priceLabel ? <span>{priceLabel}</span> : null}
            <span>{seatsLabel}</span>
          </div>
          {detail.projection.shortDescription ? (
            <p className="text-sm text-muted-foreground">{detail.projection.shortDescription}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tour-edit-title">{t("titleLabel")}</Label>
            <Input
              id="tour-edit-title"
              data-testid={TOUR_EDIT_TEST_IDS.title}
              value={title}
              disabled={!canEdit}
              onChange={(event) => setTitle(event.target.value)}
            />
            {!canEdit ? (
              <p className="text-xs text-muted-foreground">{t("readOnlyHint")}</p>
            ) : null}
          </div>

          {localizedError && error !== "TOUR_NOT_FOUND" ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {localizedError}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                data-testid={TOUR_EDIT_TEST_IDS.retry}
                onClick={() => setFetchNonce((value) => value + 1)}
              >
                {tCommon("retry")}
              </Button>
            </div>
          ) : null}

          {canEdit ? (
            <Button
              type="button"
              data-testid={TOUR_EDIT_TEST_IDS.save}
              disabled={saving || title.trim().length === 0}
              onClick={() => void handleSave()}
            >
              {saving ? tCommon("saving") : t("saveChanges")}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
