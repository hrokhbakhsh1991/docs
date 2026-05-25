"use client";

import {
  buildRegistrationIntakeSchema,
  mapIntakeToRegistrationRequest,
  type RegistrationFieldPolicy,
  type RegistrationIntakeFormValues,
  type RegistrationIntakeSchemaMessages,
} from "@repo/shared-contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button, EmptyState, FormField, Input, LoadingState, Textarea } from "@tour/ui";

import { guestIntakeDefaults } from "@/features/registrations/booking-target/mapMeToIntakePrefill";
import {
  fetchPublicTourDetail,
  mintPublicRegistrationIdempotencyKey,
  publicRegisterTourOpen,
} from "@/features/public-site/services/public-tours.service";
import { resolveTourAllowPrivateCar, toTourAllowPrivateCarInput } from "@/lib/tours/registration-policy";
import { ApiError } from "@/lib/api-client";

import styles from "./PublicRegisterForm.module.css";

const PUBLIC_REGISTER_MESSAGES: RegistrationIntakeSchemaMessages = {
  fullNameRequired: "نام و نام خانوادگی الزامی است.",
  phoneRequired: "شماره تماس الزامی است.",
  phoneTooLong: "شماره تماس بیش از حد طولانی است.",
  phoneFormat: "فرمت شماره تماس معتبر نیست.",
  nationalIdRequired: "کد ملی الزامی است.",
  nationalIdInvalid: "کد ملی معتبر نیست.",
  peaksRequired: "سوابق قله‌ها الزامی است.",
  seatOnlySelfVehicle: "ظرفیت خودرو فقط برای خودروی شخصی است.",
  seatRange: "ظرفیت خودرو باید بین ۱ تا ۳ باشد.",
  isDriverRequired: "مشخص کنید راننده هستید یا نه.",
  plateNumberRequired: "پلاک خودرو الزامی است.",
  shareFuelCostRequired: "مشارکت در هزینه سوخت را مشخص کنید.",
  privateCarNotAllowedOnTour: "این تور امکان خودروی شخصی ندارد.",
  sportsInsuranceRequired: "بیمه ورزشی الزامی است.",
};

export type PublicRegisterFormProps = {
  tourId: string;
  programLabel: string;
  contentWorkspace: string;
  catalogListPath: string;
  catalogDetailPath: string;
};

type SubmitOutcome =
  | { kind: "registered" }
  | { kind: "waitlisted"; queuePosition: number };

export function PublicRegisterForm({
  tourId,
  programLabel,
  contentWorkspace,
  catalogListPath,
  catalogDetailPath,
}: PublicRegisterFormProps) {
  const [submitOutcome, setSubmitOutcome] = useState<SubmitOutcome | null>(null);

  const tourQuery = useQuery({
    queryKey: ["public-tour-register", contentWorkspace, tourId],
    queryFn: () => fetchPublicTourDetail(tourId),
    enabled: Boolean(tourId?.trim()),
  });

  const tour = tourQuery.data;

  const policy = useMemo((): RegistrationFieldPolicy => {
    const participation = tour?.details?.tripDetails?.participation;
    const allowPrivateCar =
      tour?.registrationPolicy?.allowPrivateCar ??
      (tour ? resolveTourAllowPrivateCar(toTourAllowPrivateCarInput(tour)) : false);
    return {
      nationalIdRequired: participation?.registrationNationalIdRequired === true,
      profileNationalIdPresent: false,
      sportsInsuranceRequired: participation?.sportsInsuranceRequired === true,
      requirePeakHistory: false,
      allowPrivateCar,
    };
  }, [tour]);

  const schema = useMemo(
    () => buildRegistrationIntakeSchema(policy, PUBLIC_REGISTER_MESSAGES),
    [policy],
  );

  const form = useForm<RegistrationIntakeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: guestIntakeDefaults() as RegistrationIntakeFormValues,
    mode: "onChange",
  });

  const registerMutation = useMutation({
    mutationFn: async (values: RegistrationIntakeFormValues) => {
      const request = mapIntakeToRegistrationRequest(values, tourId);
      await mintPublicRegistrationIdempotencyKey(tourId);
      const result = await publicRegisterTourOpen(tourId, request);
      if (result.outcome === "waitlisted") {
        return { kind: "waitlisted" as const, queuePosition: result.queuePosition };
      }
      return { kind: "registered" as const };
    },
    onSuccess: (outcome) => {
      setSubmitOutcome(outcome);
    },
  });

  if (tourQuery.isLoading) {
    return (
      <div className={styles.wrap}>
        <LoadingState message="در حال بارگذاری…" />
      </div>
    );
  }

  if (tourQuery.isError || !tour) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="تور در دسترس نیست"
          description="امکان ثبت‌نام برای این تور وجود ندارد."
          action={
            <Link href={catalogListPath}>
              <Button type="button" variant="secondary">
                بازگشت
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (submitOutcome?.kind === "waitlisted") {
    return (
      <div className={styles.wrap}>
        <div className={styles.success}>
          <p>
            ظرفیت تکمیل است. شما در صف انتظار با موقعیت {submitOutcome.queuePosition} قرار گرفتید.
          </p>
          <Link href={catalogListPath}>
            <Button type="button" variant="secondary">
              فهرست تورها
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (submitOutcome?.kind === "registered") {
    return (
      <div className={styles.wrap}>
        <div className={styles.success}>
          <p>ثبت‌نام با موفقیت انجام شد.</p>
          <Link href={catalogDetailPath}>
            <Button type="button" variant="primary">
              بازگشت به تور
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const mutationError =
    registerMutation.error instanceof ApiError
      ? registerMutation.error.message
      : registerMutation.error instanceof Error
        ? registerMutation.error.message
        : null;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>ثبت‌نام — {tour.title}</h1>
      <p className={styles.subtitle}>
        فرم عمومی · {programLabel} ({contentWorkspace})
      </p>

      <form
        className={styles.form}
        onSubmit={form.handleSubmit((values) => registerMutation.mutate(values))}
        noValidate
      >
        <FormField label="نام و نام خانوادگی" error={form.formState.errors.participantFullName?.message}>
          <Input {...form.register("participantFullName")} autoComplete="name" />
        </FormField>

        <FormField label="شماره تماس" error={form.formState.errors.participantContactPhone?.message}>
          <Input {...form.register("participantContactPhone")} autoComplete="tel" dir="ltr" />
        </FormField>

        {policy.nationalIdRequired ? (
          <FormField label="کد ملی" error={form.formState.errors.participantNationalId?.message}>
            <Input {...form.register("participantNationalId")} dir="ltr" inputMode="numeric" />
          </FormField>
        ) : null}

        <FormField label="یادداشت (اختیاری)" error={form.formState.errors.participantNote?.message}>
          <Textarea {...form.register("participantNote")} rows={3} />
        </FormField>

        {mutationError ? <p className={styles.error}>{mutationError}</p> : null}

        <div className={styles.row}>
          <Button type="submit" variant="primary" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? "در حال ارسال…" : "ثبت‌نام"}
          </Button>
          <Link href={catalogDetailPath}>
            <Button type="button" variant="secondary">
              انصراف
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
