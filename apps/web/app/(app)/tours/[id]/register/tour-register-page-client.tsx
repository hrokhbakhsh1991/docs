"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedDatePicker } from "@/components/i18n/localized-date-picker";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { buildBookingCreatePayload } from "@/features/bookings/bookings-create-logic";
import type {
  BookingCreateFormState,
  BookingCreateResponse,
  BookingCreateTourOption,
} from "@/features/bookings/bookings-create-types";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";
import {
  buildTourRegisterSuccessRedirect,
  initRegisterFormFromTour,
  mapTourDetailToCreateOption,
} from "@/features/tours/tour-register-logic";
import { TOUR_REGISTER_TEST_IDS } from "@/features/tours/tour-register-types";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

import { TourStatusBadge } from "../../tour-status-badge";
import { resolveTourRegisterGateState } from "./tour-register-gate";

type TourRegisterPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
};

export function TourRegisterPageClient({ session, tourId }: TourRegisterPageClientProps) {
  const t = useTranslations("tours.register");
  const tErrors = useTranslations("tours.register.errors");
  const tNav = useTranslations("tours.nav");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const canManage = isAdminOrOwnerRole(session.role);
  const [tour, setTour] = useState<BookingCreateTourOption | null>(null);
  const [tourUiStatus, setTourUiStatus] = useState<TourUiStatus>("draft");
  const [form, setForm] = useState<BookingCreateFormState | null>(null);
  const [loadingTour, setLoadingTour] = useState(canManage);
  const [tourNotFound, setTourNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageState = resolveTourRegisterGateState({
    canManage,
    loadingTour,
    submitting,
    error,
    tourNotFound,
  });

  const tourOptions = useMemo(
    () => (tour === null ? [] : [tour]),
    [tour]
  );

  useEffect(() => {
    if (!canManage) {
      setLoadingTour(false);
      return;
    }
    let cancelled = false;
    setLoadingTour(true);
    setTourNotFound(false);
    setError(null);
    void fetch(`/api/tours/${encodeURIComponent(tourId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(`TOUR_REGISTER_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorTourDetailResponse;
      })
      .then((detail) => {
        if (cancelled) {
          return;
        }
        if (detail === null) {
          setTourNotFound(true);
          setTour(null);
          setForm(null);
          return;
        }
        const option = mapTourDetailToCreateOption(detail);
        setTour(option);
        setTourUiStatus(detail.projection.uiStatus);
        setForm(initRegisterFormFromTour(option));
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_REGISTER_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTour(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, tourId]);

  const updateField = <K extends keyof BookingCreateFormState>(
    key: K,
    value: BookingCreateFormState[K]
  ) => {
    setForm((current) => (current === null ? current : { ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form === null) {
      return;
    }
    setError(null);
    const payload = buildBookingCreatePayload(form, tourOptions);
    if (payload === null) {
      setError("TOUR_REGISTER_INVALID");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as BookingCreateResponse;
      if (response.status === 403) {
        throw new Error("TOUR_REGISTER_FORBIDDEN");
      }
      if (!response.ok || body.status !== "pending") {
        throw new Error(`TOUR_REGISTER_HTTP_${response.status}`);
      }
      router.push(buildTourRegisterSuccessRedirect(tourId));
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "TOUR_REGISTER_FAILED");
      setSubmitting(false);
    }
  };

  const localizedError =
    pageState.type === "error"
      ? resolveTourErrorMessage(tErrors, pageState.message) ?? pageState.message
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-testid={TOUR_REGISTER_TEST_IDS.page}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/tours/${encodeURIComponent(tourId)}/workspace`}>
          <Button type="button" variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {tNav("workspace")}
          </Button>
        </Link>
        <Link href={`/tours/${encodeURIComponent(tourId)}/edit`}>
          <Button type="button" variant="outline" size="sm">
            {tNav("editTour")}
          </Button>
        </Link>
      </div>

      <PageHeader title={t("pageTitle")} description={t("pageSubtitle")} />

      {pageState.type === "locked" ? (
        <Card data-testid={TOUR_REGISTER_TEST_IDS.locked}>
          <CardHeader>
            <CardTitle>{t("lockedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("lockedDescription")}
          </CardContent>
        </Card>
      ) : null}

      {pageState.type === "loading_tour" ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {pageState.type === "not_found" ? (
        <Card>
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
      ) : null}

      {pageState.type === "error" ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{localizedError}</CardContent>
        </Card>
      ) : null}

      {pageState.type === "ready" || pageState.type === "submitting" ? (
        <Card>
          <CardHeader className="space-y-2">
            <TourStatusBadge status={tourUiStatus} />
            <CardTitle
              className="flex items-center gap-2 text-xl"
              data-testid={TOUR_REGISTER_TEST_IDS.tourTitle}
            >
              {tour?.title ?? t("defaultTourTitle")}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <UserPlus className="size-4" />
              {t("guestDetails")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {form === null ? null : (
              <form
                className="space-y-4"
                data-testid={TOUR_REGISTER_TEST_IDS.form}
                onSubmit={(event) => void handleSubmit(event)}
              >
                <div className="space-y-2">
                  <Label htmlFor="register-guest">{t("guestName")}</Label>
                  <Input
                    id="register-guest"
                    data-testid={TOUR_REGISTER_TEST_IDS.guestInput}
                    value={form.guestLabel}
                    onChange={(event) => updateField("guestLabel", event.target.value)}
                    placeholder={t("guestNamePlaceholder")}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-party">{t("partySize")}</Label>
                    <LocalizedNumericInput
                      id="register-party"
                      data-testid={TOUR_REGISTER_TEST_IDS.partyInput}
                      mode="digits"
                      value={form.partySize}
                      onChange={(value) => updateField("partySize", value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-departure">{t("departureDate")}</Label>
                    <LocalizedDatePicker
                      id="register-departure"
                      data-testid={TOUR_REGISTER_TEST_IDS.departureInput}
                      value={form.departureAt}
                      onChange={(departureAt) => updateField("departureAt", departureAt)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t("emailOptional")}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={form.guestEmail}
                      onChange={(event) => updateField("guestEmail", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-phone">{t("phoneOptional")}</Label>
                    <LocalizedNumericInput
                      id="register-phone"
                      mode="phone"
                      value={form.guestPhone}
                      onChange={(value) => updateField("guestPhone", value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={pageState.type === "submitting"}
                    data-testid={TOUR_REGISTER_TEST_IDS.submitButton}
                  >
                    {t("submit")}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/tours/${encodeURIComponent(tourId)}/workspace`}>
                      {tCommon("cancel")}
                    </Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
