"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import {
  Button,
  Card,
  CardBody,
  cn,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Textarea,
} from "@tour/ui";

import type { RegistrationIntakeFormValues } from "@/features/registrations/booking-target/buildRegistrationIntakeSchema";
import { clearPrivateCarFields } from "@/features/registrations/booking-target/clearPrivateCarFields";
import { useRegistrationBookingTarget } from "@/features/registrations/booking-target/useRegistrationBookingTarget";
import type { RegistrationFieldPolicy } from "@/features/registrations/booking-target/types";
import { resolveTourAllowPrivateCar } from "@/lib/tours/registration-policy";
import { useTourDetail } from "@/features/tours/hooks/useTourDetail";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { patchMeNationalId } from "@/lib/services/me-profile.service";
import { registrationNeedsPaymentUi } from "@/lib/payment-flow";
import { bookingKeys, registrationKeys, tourKeys } from "@/lib/query-keys";
import { publicRegisterTour, registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";

import { REGISTER_FOR_TOUR_COPY } from "./register-for-tour-copy";

import registerStyles from "./register-for-tour.module.css";

const transportCopy = REGISTER_FOR_TOUR_COPY.transport;
const validationCopy = REGISTER_FOR_TOUR_COPY.validation;

function registerTourErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not complete registration. Please try again.";
  }
  if (error.code === "REGISTRATION_DUPLICATE_ACTIVE") {
    return "You already have an active registration for this tour.";
  }
  if (error.code === "PROFILE_NATIONAL_ID_REQUIRED") {
    return "کد ملی در پروفایل شما ثبت نشده است. لطفاً کد ملی را در همین فرم وارد کنید.";
  }
  if (error.code === "REGISTRATION_AUTH_REQUIRED") {
    return "This tour requires a signed-in session with your workspace cookies. Sign in again and retry.";
  }
  if (error.code === "PEAK_REQUIREMENT_NOT_MET") {
    return "شما حداقل سوابق لازم برای ثبت‌نام در این تور را ندارید.";
  }
  return error.message.trim() || "Could not complete registration. Please try again.";
}

const breadcrumbTrail = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tours", href: "/tours" },
  { label: "Register" },
] as const;

export type RegisterForTourClientProps = {
  tourId: string;
};

export function RegisterForTourClient({ tourId }: RegisterForTourClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceQueryScope();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leaderTenantReady = Boolean(user?.tenantId?.trim());
  const liveApiFull = toursUseLiveApi() && registrationsUseLiveApi();
  const tourQueryEnabled =
    Boolean(tourId?.trim()) && liveApiFull && isHydrated && isAuthenticated && leaderTenantReady;

  const {
    tour,
    isLoading: tourLoading,
    isFetching: tourFetching,
    isError: tourIsError,
    error: tourError,
    refetch: refetchTour,
  } = useTourDetail(tourId, { enabled: tourQueryEnabled });

  const requiresNationalIdRegistration =
    tour?.details?.tripDetails?.participation?.registrationNationalIdRequired === true;

  const requiresPersonalInsurance =
    tour?.details?.tripDetails?.participation?.personalInsuranceRequired === true;

  const allowPrivateCar = useMemo(() => {
    if (tour?.registrationPolicy != null) {
      return tour.registrationPolicy.allowPrivateCar;
    }
    if (tour == null) {
      return false;
    }
    return resolveTourAllowPrivateCar(tour);
  }, [tour]);

  const policy = useMemo(
    (): RegistrationFieldPolicy => ({
      nationalIdRequired: requiresNationalIdRegistration,
      profileNationalIdPresent: false,
      personalInsuranceRequired: requiresPersonalInsurance,
      requirePeakHistory: false,
      allowPrivateCar,
    }),
    [requiresNationalIdRegistration, requiresPersonalInsurance, allowPrivateCar],
  );

  const options = useMemo(
    (): RegistrationOptions => ({
      travelInsuranceAvailable:
        tour?.details?.tripDetails?.participation?.travelInsuranceAvailable === true,
    }),
    [tour],
  );

  const intakeMessages = useMemo(
    () => ({
      fullNameRequired: validationCopy.fullNameRequired,
      phoneRequired: validationCopy.phoneRequired,
      phoneTooLong: validationCopy.phoneTooLong,
      phoneFormat: validationCopy.phoneFormat,
      nationalIdRequired: validationCopy.nationalIdRequired,
      nationalIdInvalid: validationCopy.nationalIdInvalid,
      seatOnlySelfVehicle: transportCopy.seatOnlySelfVehicle,
      seatRange: transportCopy.seatRange,
      isDriverRequired: "Please specify if you are the driver.",
      plateNumberRequired: "Plate number is required for drivers.",
      shareFuelCostRequired: "Please specify if you want to share fuel costs.",
      personalInsuranceRequired: transportCopy.personalInsuranceRequired,
      privateCarNotAllowedOnTour: "این تور امکان ثبت‌نام با خودروی شخصی ندارد.",
    }),
    [],
  );

  const {
    bookingTarget,
    setBookingTarget,
    form: {
      register,
      handleSubmit,
      watch,
      setValue,
      formState: { errors, isSubmitting },
    },
    meQuery,
    submitBlocked,
    profileNationalIdPresent,
    profileNationalId,
    showGuestNationalIdField,
    showSelfNationalIdField,
    showSelfNationalIdReadOnly,
    lockSelfIdentityFields,
  } = useRegistrationBookingTarget({
    enabled: tourQueryEnabled,
    policy,
    messages: intakeMessages,
  });

  const transportMode = watch("transportMode");
  const isDriver = watch("isDriver");

  useEffect(() => {
    if (!allowPrivateCar) {
      setValue("transportMode", "group_vehicle", { shouldValidate: true });
      clearPrivateCarFields(setValue);
      return;
    }
    if (transportMode !== "self_vehicle") {
      clearPrivateCarFields(setValue);
    }
  }, [allowPrivateCar, transportMode, setValue]);

  useEffect(() => {
    if (transportMode === "self_vehicle") {
      if (isDriver) {
        setValue("shareFuelCost", undefined, { shouldValidate: true });
      } else {
        setValue("plateNumber", undefined, { shouldValidate: true });
        setValue("vehicleSeatCapacity", undefined, { shouldValidate: true });
      }
    }
  }, [isDriver, transportMode, setValue]);

  const profileCopy = REGISTER_FOR_TOUR_COPY.profile;

  const placementMutation = useMutation({
    mutationFn: async (values: RegistrationIntakeFormValues) => {
      if (!user?.tenantId?.trim()) throw new Error("Missing tenant.");

      if (
        values.bookingTarget === "self" &&
        requiresNationalIdRegistration &&
        !profileNationalIdPresent &&
        meQuery.data
      ) {
        const trimmedProfileNid = values.participantNationalId?.trim() ?? "";
        if (!trimmedProfileNid) {
          throw new ApiError(
            "VALIDATION_REQUIRED_FIELD_MISSING",
            validationCopy.nationalIdRequired,
            400,
          );
        }
        await patchMeNationalId(trimmedProfileNid, meQuery.data);
        await queryClient.invalidateQueries({
          queryKey: ["me", tenantId ?? "", "registration-intake"],
        });
      }

      const trimmedNote = values.participantNote?.trim();
      const trimmedNationalId =
        values.bookingTarget === "guest" ? values.participantNationalId?.trim() : "";
      const isSelfVehicle = values.transportMode === "self_vehicle";

      const seat =
        isSelfVehicle &&
        values.isDriver &&
        typeof values.vehicleSeatCapacity === "number" &&
        Number.isInteger(values.vehicleSeatCapacity) &&
        values.vehicleSeatCapacity >= 1 &&
        values.vehicleSeatCapacity <= 3
          ? values.vehicleSeatCapacity
          : undefined;

      const body = {
        tourId,
        bookingTarget: values.bookingTarget,
        participantFullName: values.participantFullName.trim(),
        participantContactPhone: values.participantContactPhone.trim(),
        transportMode: values.transportMode,
        entryMode: "web" as const,
        personalInsurance: values.personalInsurance,
        travelInsurance: values.travelInsurance,
        ...(isSelfVehicle
          ? {
              isDriver: values.isDriver,
              ...(values.isDriver
                ? {
                    plateNumber: values.plateNumber?.trim(),
                    ...(seat !== undefined ? { vehicleSeatCapacity: seat } : {}),
                  }
                : {
                    shareFuelCost: values.shareFuelCost,
                  }),
            }
          : {}),
        ...(trimmedNote ? { participantNote: trimmedNote } : {}),
        ...(trimmedNationalId ? { participantNationalId: trimmedNationalId } : {}),
      };

      return publicRegisterTour(tourId, body);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: registrationKeys.tourWaitlist(tourId) });
      void queryClient.invalidateQueries({ queryKey: registrationKeys.tourRegistrations(tourId) });
      void queryClient.invalidateQueries({ queryKey: tourKeys.detail(tourId) });
      if (data.outcome === "registered") {
        void queryClient.invalidateQueries({ queryKey: registrationKeys.detail(data.booking.id) });
        toast.success({ message: "Registration submitted." });
      } else {
        toast.success({
          message: `You are on the waitlist (position ${data.queuePosition}).`,
        });
      }
    },
    onError: (error: unknown) => {
      toast.error({ message: registerTourErrorMessage(error) });
    },
  });

  useEffect(() => {
    placementMutation.reset();
    setBookingTarget("self");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  const title = tour?.title ?? "Register for tour";
  const placement = placementMutation.data;
  const lastRegId = placement?.outcome === "registered" ? placement.booking.id : undefined;
  const owesPaymentAfterRegister =
    placement?.outcome === "registered"
      ? registrationNeedsPaymentUi({
          status: placement.booking.status,
          paymentStatus: placement.booking.paymentStatus,
          tour,
          lockedPricing: placement.booking.lockedPricing,
        })
      : false;

  const tourErrorMessage =
    tourError instanceof ApiError
      ? tourError.status === 404
        ? "No tour was found with this id."
        : tourError.message.trim() || "Could not load tour. Please try again."
      : tourError instanceof Error
        ? tourError.message
        : "Could not load tour. Please try again.";

  if (!isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={registerStyles.stateCard}>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApiFull && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <EmptyState
          title="Sign in required"
          description="Sign in to complete the registration intake."
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (!liveApiFull) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <EmptyState
          title="Workspace API not configured"
          description="Use your workspace host so tours and registrations reach the live API."
          action={
            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
              Back to dashboard
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (isAuthenticated && !leaderTenantReady) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <EmptyState
          title="Tenant not available"
          description="Your account is missing tenant context. Sign in again to refresh your session."
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in again
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (tourLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={registerStyles.stateCard}>
          <CardBody>
            <LoadingState message="Loading tour…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (tourIsError) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={registerStyles.stateCard}>
          <CardBody>
            <ErrorState title="Could not load tour" message={tourErrorMessage} onRetry={() => void refetchTour()} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!tour) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Register for tour"
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <EmptyState
          title="Tour not found"
          description="No tour exists with this id."
          action={
            <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
              Back to tours
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (tour.lifecycleStatus !== "OPEN") {
    return (
      <RegisteredWorkspacePage
        documentTitle={title}
        title="Register for tour"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <EmptyState
          title="Registrations are closed"
          description="This tour is not accepting new registrations."
          action={
            <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}>
              Back to tour
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  const tourRefetching = Boolean(tour && !tourLoading && tourFetching);

  return (
    <RegisteredWorkspacePage
      documentTitle={title}
      title={title}
      description={tour?.title ? `Tour: ${tour.title}` : undefined}
      breadcrumbItems={[...breadcrumbTrail]}
      actions={null}
    >
      <div
        className={cn(
          registerStyles.contentRoot,
          tourRefetching ? registerStyles.contentRootRefreshing : undefined,
        )}
        aria-busy={tourRefetching ? true : undefined}
      >
        {tourRefetching ? (
          <span className={registerStyles.liveRegion} aria-live="polite">
            Updating tour
          </span>
        ) : null}
        <Card>
          <CardBody>
            {placementMutation.isSuccess && lastRegId ? (
              <div data-testid="register-success">
                <p role="status">Your registration was created.</p>
                {placement?.outcome === "registered" && placement.paymentIntent ? (
                  <p className={registerStyles.successStack}>
                    Payment record started — status{" "}
                    <strong>{placement.paymentIntent.status}</strong> ({placement.paymentIntent.currency}{" "}
                    {placement.paymentIntent.amount}). Open details to monitor settlement.
                  </p>
                ) : null}
                {placement?.outcome === "registered" && owesPaymentAfterRegister && !placement.paymentIntent ? (
                  <p className={registerStyles.successStack}>
                    Next step: create a checkout intent from your registration detail (payment confirms your seat
                    asynchronously).
                  </p>
                ) : null}
                <p className={registerStyles.successStack}>
                  Registration ID: <strong>{lastRegId}</strong>
                </p>
                <div className={registerStyles.successActions}>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() =>
                      router.push(`/bookings/${lastRegId}${owesPaymentAfterRegister ? "?checkout=1" : ""}`)
                    }
                  >
                    {owesPaymentAfterRegister ? "Open registration & pay" : "Track status"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}`)}>
                    Back to tour
                  </Button>
                </div>
              </div>
            ) : placementMutation.isSuccess && placement?.outcome === "waitlisted" ? (
              <div data-testid="register-success" role="status">
                <p>You are on the waitlist for this tour.</p>
                <p className={registerStyles.waitlistMeta}>
                  Queue position: <strong>{placement.queuePosition}</strong>
                </p>
                <Link href={`/tours/${tourId}`} className={registerStyles.returnLink}>
                  Return to tour
                </Link>
              </div>
            ) : (
              <form
                className={registerStyles.rtlForm}
                dir="rtl"
                noValidate
                onSubmit={handleSubmit((values) => {
                  placementMutation.mutate(values);
                })}
              >
                <p className={registerStyles.formLead}>
                  Complete the intake form. Placement uses{" "}
                  <strong>
                    POST /api/v2/tours/
                    {"{"}tourId{"}"}/register
                  </strong>{" "}
                  (capacity-aware — full tours are waitlisted in the same response).
                </p>
                <fieldset className={registerStyles.transportFieldset}>
                  <legend className={registerStyles.transportLegend}>ثبت‌نام برای</legend>
                  <label className={registerStyles.radioOption}>
                    <input
                      type="radio"
                      name="bookingTarget"
                      checked={bookingTarget === "self"}
                      onChange={() => setBookingTarget("self")}
                    />
                    <span>خودم</span>
                  </label>
                  <label className={registerStyles.radioOption}>
                    <input
                      type="radio"
                      name="bookingTarget"
                      checked={bookingTarget === "guest"}
                      onChange={() => setBookingTarget("guest")}
                    />
                    <span>مهمان / فرد دیگر</span>
                  </label>
                </fieldset>
                {bookingTarget === "self" && requiresNationalIdRegistration && meQuery.isLoading ? (
                  <p className={registerStyles.profileGateMuted}>در حال بارگذاری پروفایل…</p>
                ) : null}
                {bookingTarget === "self" && requiresNationalIdRegistration && meQuery.isError ? (
                  <p role="alert">
                    بارگذاری پروفایل ناموفق بود. صفحه را تازه‌سازی کنید یا دوباره وارد شوید.
                  </p>
                ) : null}
                <FormField label="نام و نام خانوادگی" required error={errors.participantFullName?.message}>
                  <Input
                    autoComplete="name"
                    readOnly={lockSelfIdentityFields}
                    {...register("participantFullName")}
                  />
                </FormField>
                <FormField label="شماره تماس" required error={errors.participantContactPhone?.message}>
                  <Input
                    autoComplete="tel"
                    readOnly={lockSelfIdentityFields}
                    {...register("participantContactPhone")}
                  />
                </FormField>
                {showSelfNationalIdField ? (
                  <FormField
                    label={profileCopy.selfNationalIdLabel}
                    required
                    description={profileCopy.selfNationalIdHint}
                    error={errors.participantNationalId?.message}
                  >
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      data-testid="register-self-national-id"
                      {...register("participantNationalId")}
                    />
                  </FormField>
                ) : null}
                {showSelfNationalIdReadOnly ? (
                  <FormField
                    label={profileCopy.selfNationalIdLabel}
                    description={profileCopy.selfNationalIdReadOnlyHint}
                  >
                    <Input
                      readOnly
                      value={profileNationalId}
                      data-testid="register-self-national-id-readonly"
                      {...register("participantNationalId")}
                    />
                  </FormField>
                ) : null}
                {showGuestNationalIdField ? (
                  <FormField
                    label="کد ملی شرکت‌کننده"
                    required
                    error={errors.participantNationalId?.message}
                  >
                    <Input inputMode="numeric" {...register("participantNationalId")} />
                  </FormField>
                ) : null}
                <fieldset className={registerStyles.transportFieldset} data-testid="register-transport">
                  <legend className={registerStyles.transportLegend}>{transportCopy.fieldLabel}</legend>
                  {errors.transportMode?.message ? (
                    <p role="alert" style={{ margin: 0, color: "var(--color-danger-fg, #b42318)" }}>
                      {errors.transportMode.message}
                    </p>
                  ) : null}
                  {allowPrivateCar ? (
                    <>
                      <label className={registerStyles.radioOption}>
                        <input type="radio" value="group_vehicle" {...register("transportMode")} />
                        <span>{transportCopy.publicTransport}</span>
                      </label>
                      <label className={registerStyles.radioOption}>
                        <input type="radio" value="self_vehicle" {...register("transportMode")} />
                        <span>{transportCopy.selfVehicle}</span>
                      </label>
                    </>
                  ) : (
                    <p className={registerStyles.profileGateMuted}>{transportCopy.groupOnlyHint}</p>
                  )}
                </fieldset>
                {allowPrivateCar && transportMode === "self_vehicle" ? (
                  <div className={registerStyles.personalVehicleOptions}>
                    <label className={registerStyles.checkboxOption}>
                      <input type="checkbox" {...register("isDriver")} />
                      <span>{transportCopy.isDriverLabel}</span>
                    </label>
                    {errors.isDriver?.message ? (
                      <p role="alert" style={{ margin: 0, color: "var(--color-danger-fg, #b42318)" }}>
                        {errors.isDriver.message}
                      </p>
                    ) : null}

                    {isDriver === true ? (
                      <>
                        <FormField
                          label={transportCopy.plateNumberLabel}
                          required
                          error={errors.plateNumber?.message}
                        >
                          <Input
                            placeholder={transportCopy.plateNumberPlaceholder}
                            {...register("plateNumber")}
                          />
                        </FormField>
                        <FormField
                          label={transportCopy.seatLabel}
                          description={transportCopy.seatHint}
                          error={errors.vehicleSeatCapacity?.message}
                        >
                          <Input
                            type="number"
                            min={1}
                            max={3}
                            inputMode="numeric"
                            className={registerStyles.seatInput}
                            aria-label={transportCopy.seatLabel}
                            {...register("vehicleSeatCapacity", {
                              setValueAs: (v: unknown) => {
                                if (v === "" || v === undefined || v === null) return undefined;
                                const n = typeof v === "number" ? v : Number(v);
                                return Number.isFinite(n) ? n : undefined;
                              },
                            })}
                          />
                        </FormField>
                      </>
                    ) : (
                      <label className={registerStyles.checkboxOption}>
                        <input type="checkbox" {...register("shareFuelCost")} />
                        <span>{transportCopy.shareFuelCostLabel}</span>
                      </label>
                    )}
                  </div>
                ) : null}
                {policy.personalInsuranceRequired || options.travelInsuranceAvailable ? (
                  <fieldset className={registerStyles.transportFieldset}>
                    <legend className={registerStyles.transportLegend}>بیمه</legend>
                    {policy.personalInsuranceRequired ? (
                      <div className={registerStyles.insuranceOption}>
                        <label className={registerStyles.checkboxOption}>
                          <input type="checkbox" {...register("personalInsurance")} />
                          <span>{transportCopy.personalInsuranceLabel}</span>
                        </label>
                        {errors.personalInsurance?.message ? (
                          <p
                            role="alert"
                            style={{ margin: 0, color: "var(--color-danger-fg, #b42318)" }}
                          >
                            {errors.personalInsurance.message}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {options.travelInsuranceAvailable ? (
                      <label className={registerStyles.checkboxOption}>
                        <input type="checkbox" {...register("travelInsurance")} />
                        <span>{transportCopy.travelInsuranceLabel}</span>
                      </label>
                    ) : null}
                  </fieldset>
                ) : null}
                <FormField label={transportCopy.noteLabel} error={errors.participantNote?.message}>
                  <Textarea
                    rows={4}
                    placeholder={transportCopy.notePlaceholder}
                    {...register("participantNote")}
                  />
                </FormField>
                <div className={registerStyles.submitRow}>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || placementMutation.isPending || submitBlocked}
                  >
                    {placementMutation.isPending ? "Submitting…" : "Submit registration"}
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </RegisteredWorkspacePage>
  );
}
