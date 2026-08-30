"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { OperatorTourSelect } from "@/admin/patterns/operator-tour-select";
import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedDatePicker } from "@/components/i18n/localized-date-picker";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import {
  buildBookingCreatePayload,
  departureInputFromTour,
} from "@/features/bookings/bookings-create-logic";
import {
  BOOKINGS_CREATE_TEST_IDS,
  DEFAULT_BOOKING_CREATE_FORM,
  type BookingCreateFormState,
  type BookingCreateResponse,
  type BookingCreateTourOption,
} from "@/features/bookings/bookings-create-types";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
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
  const [knownTours, setKnownTours] = useState<readonly BookingCreateTourOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageState = resolveBookingsCreatePageState({
    canManage,
    loadingTours: false,
    submitting,
    error,
  });

  const selectedTour = useMemo(
    () => knownTours.find((tour) => tour.id === form.tourId),
    [form.tourId, knownTours]
  );

  const updateField = <K extends keyof BookingCreateFormState>(
    key: K,
    value: BookingCreateFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleTourChange = (tourId: string) => {
    const tour = knownTours.find((item) => item.id === tourId);
    setForm((current) => ({
      ...current,
      tourId,
      departureAt: departureInputFromTour(tour) || current.departureAt,
    }));
  };

  const handleTourResolved = (tour: {
    readonly id: string;
    readonly title: string;
    readonly departureAt: string | null;
  }) => {
    const option: BookingCreateTourOption = {
      id: tour.id,
      title: tour.title,
      departureAt: tour.departureAt,
    };
    setKnownTours((current) => {
      if (current.some((item) => item.id === option.id)) {
        return current;
      }
      return [...current, option];
    });
    setForm((current) => ({
      ...current,
      tourId: tour.id,
      departureAt: departureInputFromTour(option) || current.departureAt,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload = buildBookingCreatePayload(form, knownTours);
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
                <OperatorTourSelect
                  value={form.tourId}
                  onValueChange={handleTourChange}
                  onTourResolved={handleTourResolved}
                  placeholder={t("selectTour")}
                  searchPlaceholder={t("tourSearchPlaceholder")}
                  emptyLabel={t("tourNoResults")}
                  loadingLabel={t("tourLoading")}
                  ariaLabel={t("tour")}
                  testId={BOOKINGS_CREATE_TEST_IDS.tourSelect}
                />
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
