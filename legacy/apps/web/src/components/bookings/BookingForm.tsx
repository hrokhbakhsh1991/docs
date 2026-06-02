"use client";

import type { BookingDto } from "@repo/types";
import type { TourDto } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Alert, Button, Card, FormField, Input, Select, Textarea } from "@tour/ui";

import { BookingSchema, type BookingFormInput, type BookingFormValues } from "./booking-schema";

import styles from "./BookingForm.module.css";

export type BookingFormProps = {
  booking?: Partial<BookingDto> & { participantEmailValue?: string };
  tours?: TourDto[];
  onSubmit: (_values: BookingFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

function toDefaultValues(booking?: BookingFormProps["booking"]): BookingFormValues {
  if (!booking?.tourId) {
    return {
      participantName: "",
      participantEmail: "",
      tourId: "",
      seats: 1,
      note: "",
    };
  }

  return {
    participantName: booking.participantFullName ?? "",
    participantEmail: booking.participantEmailValue ?? "",
    tourId: booking.tourId ?? "",
    seats:
      typeof booking.vehicleSeatCapacity === "number" && booking.vehicleSeatCapacity >= 1
        ? booking.vehicleSeatCapacity
        : 1,
    note: typeof booking.participantNote === "string" ? booking.participantNote : "",
  };
}

export function BookingForm({ booking, tours = [], onSubmit, onCancel }: BookingFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitted, isValid },
  } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(BookingSchema),
    defaultValues: toDefaultValues(booking),
    mode: "onChange",
  });

  useEffect(() => {
    reset(toDefaultValues(booking));
  }, [booking, reset]);

  const fieldMessages = Object.entries(errors)
    .filter(([key]) => key !== "root")
    .map(([, err]) => err?.message)
    .filter(Boolean) as string[];

  async function submitValid(data: BookingFormValues) {
    try {
      await onSubmit(data);
    } catch {
      setError("root", {
        type: "submit",
        message: "Something went wrong — please try again.",
      });
    }
  }

  return (
    <Card title="Booking details" description="Maps to RegistrationResponseDto fields.">
      <div className={styles.inner}>
        {isSubmitted && fieldMessages.length > 0 ? (
          <Alert variant="error" title="Please fix the form" role="alert">
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {fieldMessages.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {errors.root?.message ? (
          <Alert variant="error" title="Could not save" role="alert">
            {errors.root.message}
          </Alert>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit(submitValid)} noValidate>
          <FormField label="Participant name" error={errors.participantName?.message}>
            <Input autoComplete="name" aria-invalid={errors.participantName ? true : undefined} {...register("participantName")} />
          </FormField>

          <FormField label="Email" error={errors.participantEmail?.message}>
            <Input
              type="email"
              autoComplete="email"
              aria-invalid={errors.participantEmail ? true : undefined}
              {...register("participantEmail")}
            />
          </FormField>

          <FormField label="Tour" error={errors.tourId?.message}>
            <Select invalid={Boolean(errors.tourId)} {...register("tourId")}>
              <option value="">Select a tour…</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Seats" description="Maps to vehicleSeatCapacity on the DTO." error={errors.seats?.message}>
            <Input type="number" min={1} step={1} aria-invalid={errors.seats ? true : undefined} {...register("seats", { valueAsNumber: true })} />
          </FormField>

          <FormField label="Note" error={errors.note?.message}>
            <Textarea rows={3} invalid={Boolean(errors.note)} {...register("note")} />
          </FormField>

          <div className={styles.actions}>
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => onCancel?.()}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting || !isValid}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

export type { BookingFormInput, BookingFormValues } from "./booking-schema";
export { BookingSchema } from "./booking-schema";
