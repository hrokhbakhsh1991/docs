"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  Select,
  Textarea,
} from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { REGISTER_FOR_TOUR_COPY } from "./register-for-tour-copy";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { registrationNeedsPaymentUi } from "@/lib/payment-flow";
import { bookingKeys, registrationKeys, tourKeys } from "@/lib/query-keys";
import { publicRegisterTour, registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useAppToast } from "@/lib/use-app-toast";
import {
  tourShowsPeakExperienceIntake,
  USER_PAST_PEAKS_OPTIONS,
} from "@/features/tours/domain/peak-experience";
import { useTourDetail } from "@/features/tours/hooks/useTourDetail";

import registerStyles from "./register-for-tour.module.css";

/** Aligned with `CreateRegistrationDto.participantContactPhone` (`@Matches` in apps/api). */
const PARTICIPANT_PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;
const transportCopy = REGISTER_FOR_TOUR_COPY.transport;
const peaksCopy = REGISTER_FOR_TOUR_COPY.peaks;
const validationCopy = REGISTER_FOR_TOUR_COPY.validation;

function buildIntakeSchema(requirePeakHistory: boolean) {
  return z
    .object({
      participantFullName: z.string().trim().min(1, validationCopy.fullNameRequired).max(255),
      participantContactPhone: z
        .string()
        .trim()
        .min(1, validationCopy.phoneRequired)
        .max(64, validationCopy.phoneTooLong)
        .regex(PARTICIPANT_PHONE_REGEX, validationCopy.phoneFormat),
      /** API: `self_vehicle` (product wording: personal / own vehicle). */
      transportMode: z.enum(["self_vehicle", "group_vehicle", "other"]),
      participantNote: z.string().trim().max(2000).optional(),
      /**
       * Extra seats for carpooling (`CreateRegistrationDto.vehicleSeatCapacity`).
       * Shown only when `transportMode === "self_vehicle"`.
       */
      vehicleSeatCapacity: z
        .number()
        .int()
        .min(1, transportCopy.seatRange)
        .max(3, transportCopy.seatRange)
        .optional(),
      userPastPeaksCount: z.number().int().min(0).max(4).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.transportMode !== "self_vehicle" && data.vehicleSeatCapacity != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: transportCopy.seatOnlySelfVehicle,
          path: ["vehicleSeatCapacity"],
        });
      }
      if (requirePeakHistory && data.userPastPeaksCount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: peaksCopy.required,
          path: ["userPastPeaksCount"],
        });
      }
    });
}

type IntakeValues = z.infer<ReturnType<typeof buildIntakeSchema>>;

function registerTourErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not complete registration. Please try again.";
  }
  if (error.code === "REGISTRATION_DUPLICATE_ACTIVE") {
    return "You already have an active registration for this tour.";
  }
  if (error.code === "PROFILE_NATIONAL_ID_REQUIRED") {
    return "This tour requires your national ID on your profile. Open Settings → Profile to add it, then try again.";
  }
  if (error.code === "REGISTRATION_AUTH_REQUIRED") {
    return "This tour requires a signed-in session with your workspace cookies. Sign in again and retry.";
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

  const tripDetailsRecord =
    tour?.details?.tripDetails != null && typeof tour.details.tripDetails === "object"
      ? (tour.details.tripDetails as Record<string, unknown>)
      : undefined;

  const showPeakExperienceIntake =
    tour != null &&
    tourShowsPeakExperienceIntake({
      tourType: tour.tourType ?? undefined,
      tripDetails: tripDetailsRecord,
    });

  const intakeSchema = useMemo(
    () => buildIntakeSchema(showPeakExperienceIntake),
    [showPeakExperienceIntake],
  );

  const meProfileQuery = useQuery({
    queryKey: ["me-profile-national-id-guard"],
    enabled: tourQueryEnabled && Boolean(tour) && requiresNationalIdRegistration,
    queryFn: async (): Promise<{ national_id?: string | null }> => {
      const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        throw new Error(`me ${res.status}`);
      }
      return (await res.json()) as { national_id?: string | null };
    },
  });

  const nationalIdMissingForTour =
    requiresNationalIdRegistration &&
    meProfileQuery.isSuccess &&
    (!meProfileQuery.data?.national_id || String(meProfileQuery.data.national_id).trim() === "");

  const nationalIdRegistrationBlocked =
    requiresNationalIdRegistration &&
    (meProfileQuery.isLoading || meProfileQuery.isError || nationalIdMissingForTour);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      participantFullName: "",
      participantContactPhone: "",
      transportMode: "group_vehicle",
      participantNote: "",
      vehicleSeatCapacity: undefined,
      userPastPeaksCount: 0,
    },
  });

  const transportMode = watch("transportMode");

  /** PERSONAL_VEHICLE in product terms === API `self_vehicle`. Clear seats when mode changes away. */
  useEffect(() => {
    if (transportMode !== "self_vehicle") {
      setValue("vehicleSeatCapacity", undefined, { shouldValidate: true, shouldDirty: false });
    }
  }, [transportMode, setValue]);

  const placementMutation = useMutation({
    mutationFn: async (values: IntakeValues) => {
      if (!user?.tenantId?.trim()) throw new Error("Missing tenant.");
      const trimmedNote = values.participantNote?.trim();
      const base = {
        tourId,
        participantFullName: values.participantFullName.trim(),
        participantContactPhone: values.participantContactPhone.trim(),
        transportMode: values.transportMode,
        entryMode: "web" as const,
        ...(trimmedNote ? { participantNote: trimmedNote } : {}),
      };
      const seat =
        values.transportMode === "self_vehicle" &&
        typeof values.vehicleSeatCapacity === "number" &&
        Number.isInteger(values.vehicleSeatCapacity) &&
        values.vehicleSeatCapacity >= 1 &&
        values.vehicleSeatCapacity <= 3
          ? values.vehicleSeatCapacity
          : undefined;
      const peaksMeta =
        showPeakExperienceIntake && typeof values.userPastPeaksCount === "number"
          ? { participantMetadata: { userPastPeaksCount: values.userPastPeaksCount } }
          : {};
      const body = seat !== undefined ? { ...base, vehicleSeatCapacity: seat } : base;
      return publicRegisterTour(tourId, { ...body, ...peaksMeta });
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
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, reset]);

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
          tourRefetching ? registerStyles.contentRootRefreshing : undefined
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
                  Next step: create a checkout intent from your registration detail (payment confirms your seat asynchronously).
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
              {requiresNationalIdRegistration ? (
                <div className={registerStyles.profileGate}>
                  {meProfileQuery.isLoading ? (
                    <p className={registerStyles.profileGateMuted}>Checking your profile for national ID…</p>
                  ) : null}
                  {meProfileQuery.isError ? (
                    <p role="alert">
                      Could not verify your profile. Refresh the page or sign in again, then retry.
                    </p>
                  ) : null}
                  {nationalIdMissingForTour ? (
                    <p role="alert">
                      This tour requires your national ID on your profile.{" "}
                      <Link href="/settings" className={registerStyles.returnLink}>
                        Open profile settings
                      </Link>{" "}
                      to add it before registering.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <FormField label="Full name" required error={errors.participantFullName?.message}>
                <Input autoComplete="name" {...register("participantFullName")} />
              </FormField>
              <FormField label="Contact phone" required error={errors.participantContactPhone?.message}>
                <Input autoComplete="tel" {...register("participantContactPhone")} />
              </FormField>
              {showPeakExperienceIntake ? (
                <FormField
                  label={peaksCopy.fieldLabel}
                  required
                  description={peaksCopy.hint}
                  error={errors.userPastPeaksCount?.message}
                >
                  <Select
                    data-testid="register-field-user-past-peaks"
                    defaultValue="0"
                    {...register("userPastPeaksCount", { valueAsNumber: true })}
                  >
                    {USER_PAST_PEAKS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}
              <fieldset className={registerStyles.transportFieldset}>
                <legend className={registerStyles.transportLegend}>{transportCopy.fieldLabel}</legend>
                {errors.transportMode?.message ? (
                  <p role="alert" style={{ margin: 0, color: "var(--color-danger-fg, #b42318)" }}>
                    {errors.transportMode.message}
                  </p>
                ) : null}
                <label className={registerStyles.radioOption}>
                  <input
                    type="radio"
                    value="self_vehicle"
                    {...register("transportMode")}
                  />
                  <span>{transportCopy.selfVehicle}</span>
                </label>
                <label className={registerStyles.radioOption}>
                  <input
                    type="radio"
                    value="group_vehicle"
                    {...register("transportMode")}
                  />
                  <span>{transportCopy.groupVehicle}</span>
                </label>
              </fieldset>
              {transportMode === "self_vehicle" ? (
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
                  disabled={isSubmitting || placementMutation.isPending || nationalIdRegistrationBlocked}
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
