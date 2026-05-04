"use client";

import type { TourDto } from "@repo/types";
import type { TourLifecycleStatus } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Alert, Button, Card, FormField, Input, Select, Textarea } from "@tour/ui";

import { ApiError } from "@/lib/api-client";

import { apiLifecycleToFormStatus } from "./tour-lifecycle";
import { extractTourPriceUsd } from "./formatters";
import { TourSchema, type TourFormInput, type TourFormValues } from "./tour-schema";

import styles from "./TourForm.module.css";

function apiValidationMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const envelope = data as { error?: { details?: { validationErrors?: unknown } } };
  const raw = envelope.error?.details?.validationErrors;
  if (!Array.isArray(raw)) {
    return null;
  }
  const parts: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      parts.push(item);
    } else if (item && typeof item === "object" && "message" in item) {
      const m = (item as { message?: unknown }).message;
      if (typeof m === "string") {
        parts.push(m);
      }
    }
  }
  return parts.length ? parts.join(" ") : null;
}

export type TourFormProps = {
  tour?: Partial<TourDto> & {
    id?: string;
    lifecycleStatus?: TourLifecycleStatus;
    acceptedCount?: number;
  };
  mode?: "create" | "edit";
  onSubmit: (values: TourFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

function toDefaultValues(tour?: TourFormProps["tour"]): TourFormValues {
  if (!tour || (!tour.title && !tour.id)) {
    return {
      title: "",
      description: "",
      totalCapacity: 30,
      price: 0,
      status: "draft",
      communicationLink: "",
    };
  }

  const priceUsd = extractTourPriceUsd(tour.costContext);
  const status = tour.lifecycleStatus
    ? apiLifecycleToFormStatus(tour.lifecycleStatus)
    : "draft";

  return {
    title: tour.title ?? "",
    description: typeof tour.description === "string" ? tour.description : "",
    totalCapacity: typeof tour.totalCapacity === "number" && tour.totalCapacity > 0 ? tour.totalCapacity : 30,
    price: Number.isFinite(priceUsd) ? priceUsd : 0,
    status,
    communicationLink: typeof tour.communicationLink === "string" ? tour.communicationLink : "",
  };
}

export function TourForm({ tour, mode = "create", onSubmit, onCancel }: TourFormProps) {
  const resolvedMode = mode === "edit" || tour?.id ? "edit" : "create";

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<TourFormInput, unknown, TourFormValues>({
    resolver: zodResolver(TourSchema),
    defaultValues: toDefaultValues(tour),
  });

  useEffect(() => {
    reset(toDefaultValues(tour));
  }, [tour, reset]);

  const fieldMessages = Object.entries(errors)
    .filter(([key]) => key !== "root")
    .map(([, err]) => err?.message)
    .filter(Boolean) as string[];

  async function submitValid(data: TourFormValues) {
    try {
      await onSubmit(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const detailed = apiValidationMessage(err.data);
        setError("root", {
          type: "server",
          message: detailed ?? err.message ?? "Request validation failed.",
        });
        return;
      }
      setError("root", {
        type: "submit",
        message: err instanceof Error ? err.message : "Something went wrong — please try again.",
      });
    }
  }

  return (
    <Card
      title={resolvedMode === "create" ? "Create tour" : "Edit tour"}
      description="Tour fields; submits to the workspace API when NEXT_PUBLIC_API_URL is set."
    >
      <div className={styles.inner}>
        {isSubmitted && fieldMessages.length > 0 ? (
          <Alert variant="error" title="Please fix the form" role="alert">
            <ul className={styles.fieldErrorList} id="tour-form-field-error-list">
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
          <FormField label="Title" required error={errors.title?.message}>
            <Input
              placeholder="e.g. Sunset kayak tour"
              autoComplete="off"
              data-testid="tour-field-name"
              aria-invalid={errors.title ? true : undefined}
              {...register("title")}
            />
          </FormField>

          <FormField label="Description" error={errors.description?.message}>
            <Textarea
              rows={4}
              placeholder="What participants should expect"
              data-testid="tour-field-description"
              invalid={Boolean(errors.description)}
              {...register("description")}
            />
          </FormField>

          <FormField label="Total capacity" required error={errors.totalCapacity?.message}>
            <Input
              type="number"
              min={1}
              step={1}
              data-testid="tour-field-capacity"
              aria-invalid={errors.totalCapacity ? true : undefined}
              {...register("totalCapacity", { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Price (USD)"
            required
            description="Stored in costContext totalCost."
            error={errors.price?.message}
          >
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              data-testid="tour-field-price"
              aria-invalid={errors.price ? true : undefined}
              {...register("price", { valueAsNumber: true })}
            />
          </FormField>

          <FormField label="Status" required error={errors.status?.message}>
            <Select data-testid="tour-field-status" invalid={Boolean(errors.status)} {...register("status")}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              {resolvedMode === "edit" ? <option value="archived">Archived</option> : null}
            </Select>
          </FormField>

          <FormField
            label="Communication link (optional)"
            description="e.g. Telegram group invite URL."
            error={errors.communicationLink?.message}
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://t.me/…"
              autoComplete="off"
              aria-invalid={errors.communicationLink ? true : undefined}
              {...register("communicationLink")}
            />
          </FormField>

          <div className={styles.actions}>
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
              data-testid="tour-form-submit"
            >
              {resolvedMode === "create" ? "Create tour" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}

export type { TourFormInput, TourFormValues } from "./tour-schema";
export { TourSchema } from "./tour-schema";
