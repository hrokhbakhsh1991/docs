"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
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
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import {
  buildBookingCreatePayload,
  departureInputFromTour,
  mapToursToCreateOptions,
} from "@/features/bookings/bookings-create-logic";
import {
  BOOKINGS_CREATE_TEST_IDS,
  DEFAULT_BOOKING_CREATE_FORM,
  type BookingCreateFormState,
  type BookingCreateResponse,
  type BookingCreateTourOption,
} from "@/features/bookings/bookings-create-types";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import type { OperatorTourListResponse } from "@/features/tours/operator-tours-types";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

import { resolveBookingsCreatePageState } from "./bookings-create-gate";

type BookingsCreatePageClientProps = {
  readonly session: OperatorSessionContext;
};

export function BookingsCreatePageClient({ session }: BookingsCreatePageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("bookings.create");
  const tErrors = useTranslations("bookings.create.errors");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const canManage = isAdminOrOwnerRole(session.role);
  const [form, setForm] = useState<BookingCreateFormState>(DEFAULT_BOOKING_CREATE_FORM);
  const [tours, setTours] = useState<readonly BookingCreateTourOption[]>([]);
  const [loadingTours, setLoadingTours] = useState(canManage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageState = resolveBookingsCreatePageState({
    canManage,
    loadingTours,
    submitting,
    error,
  });

  const selectedTour = useMemo(
    () => tours.find((tour) => tour.id === form.tourId),
    [form.tourId, tours]
  );

  useEffect(() => {
    if (!canManage) {
      setLoadingTours(false);
      return;
    }
    let cancelled = false;
    setLoadingTours(true);
    void fetch("/api/tours?limit=50&view=operator", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOURS_LIST_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorTourListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setTours(mapToursToCreateOptions(payload.items));
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOURS_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTours(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const updateField = <K extends keyof BookingCreateFormState>(
    key: K,
    value: BookingCreateFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleTourChange = (tourId: string) => {
    const tour = tours.find((item) => item.id === tourId);
    setForm((current) => ({
      ...current,
      tourId,
      departureAt: departureInputFromTour(tour) || current.departureAt,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload = buildBookingCreatePayload(form, tours);
    if (payload === null) {
      setError("BOOKING_CREATE_INVALID");
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
        throw new Error("BOOKING_CREATE_FORBIDDEN");
      }
      if (!response.ok || body.status !== "pending") {
        throw new Error(`BOOKING_CREATE_HTTP_${response.status}`);
      }
      router.push("/bookings?status=pending");
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "BOOKING_CREATE_FAILED");
      setSubmitting(false);
    }
  };

  const localizedError =
    pageState.type === "error"
      ? resolveTourErrorMessage(tErrors, pageState.message) ?? pageState.message
      : null;

  return (
    <div className="space-y-6" data-testid={BOOKINGS_CREATE_TEST_IDS.page}>
      <PageHeader title={t("pageTitle")} description={t("pageSubtitle")} />

      {pageState.type === "locked" ? (
        <Card data-testid={BOOKINGS_CREATE_TEST_IDS.locked}>
          <CardHeader>
            <CardTitle>{t("lockedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("lockedDescription")}
          </CardContent>
        </Card>
      ) : null}

      {pageState.type === "loading_tours" ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {pageState.type === "error" ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{localizedError}</CardContent>
        </Card>
      ) : null}

      {pageState.type === "ready" || pageState.type === "submitting" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              {t("guestDetails")}
            </CardTitle>
            <CardDescription>{t("formDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              data-testid={BOOKINGS_CREATE_TEST_IDS.form}
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="space-y-2">
                <Label htmlFor="booking-tour">{t("tour")}</Label>
                <select
                  id="booking-tour"
                  data-testid={BOOKINGS_CREATE_TEST_IDS.tourSelect}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.tourId}
                  onChange={(event) => handleTourChange(event.target.value)}
                  required
                >
                  <option value="">{t("selectTour")}</option>
                  {tours.map((tour) => (
                    <option key={tour.id} value={tour.id}>
                      {tour.title}
                    </option>
                  ))}
                </select>
                {selectedTour?.departureAt ? (
                  <p className="text-xs text-muted-foreground">
                    {t("scheduledDeparture", {
                      date: formatBookingDeparture(selectedTour.departureAt, locale),
                    })}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking-guest">{t("guestName")}</Label>
                <Input
                  id="booking-guest"
                  data-testid={BOOKINGS_CREATE_TEST_IDS.guestInput}
                  value={form.guestLabel}
                  onChange={(event) => updateField("guestLabel", event.target.value)}
                  placeholder={t("guestNamePlaceholder")}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="booking-party">{t("partySize")}</Label>
                  <LocalizedNumericInput
                    id="booking-party"
                    data-testid={BOOKINGS_CREATE_TEST_IDS.partyInput}
                    mode="digits"
                    value={form.partySize}
                    onChange={(value) => updateField("partySize", value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-departure">{t("departureDate")}</Label>
                  <LocalizedDatePicker
                    id="booking-departure"
                    data-testid={BOOKINGS_CREATE_TEST_IDS.departureInput}
                    value={form.departureAt}
                    onChange={(departureAt) => updateField("departureAt", departureAt)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="booking-email">{t("emailOptional")}</Label>
                  <Input
                    id="booking-email"
                    type="email"
                    value={form.guestEmail}
                    onChange={(event) => updateField("guestEmail", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="booking-phone">{t("phoneOptional")}</Label>
                  <LocalizedNumericInput
                    id="booking-phone"
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
                  data-testid={BOOKINGS_CREATE_TEST_IDS.submitButton}
                >
                  {t("submit")}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/bookings">{tCommon("cancel")}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
