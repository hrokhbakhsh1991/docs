"use client";

import type { TourDto } from "@repo/types";
import type { TourLifecycleStatus } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";

import { Alert, Button, Card, FormField, Input, Select, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { ApiError } from "@/lib/api-client";
import { getCatalogErrorMessageKey, logTenantCatalogMismatchDev } from "@/lib/errors/tenant-catalog-tour-errors";
import { TourCreateTripDetailsFields } from "@/features/tours/components/tour-create-trip-details-fields";
import { TourDestinationSelectField } from "@/features/tours/components/tour-destination-select-field";
import { TourLocationSection } from "@/features/tours/components/tour-location-section";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";
import {
  getCoreFieldConfigForKind,
  normalizeFieldUserRole,
  resolveFieldAccess,
} from "@/features/tours/config/tripDetailsFieldConfig";
import { normalizeTripDetailsFormDefault } from "@/features/tours/models/tourTripDetails.schema";
import { isMountainTourLike, resolveEventKindFromTourContext } from "@/features/tours/policies/tour-kind-policy";
import { useAuth } from "@/lib/auth/auth-context";

import { apiLifecycleToFormStatus } from "./tour-lifecycle";
import { extractTourPriceUsd } from "./formatters";
import { createTourSchemaForEventKind, type TourFormInput, type TourFormValues } from "./tour-schema";

import styles from "./TourForm.module.css";

function defaultLocationSection(): TourFormInput["locationSection"] {
  return {
    regionId: "",
    mainDestinationId: "",
    secondaryDestinationIdsRaw: "",
    displayLocationOverride: "",
  };
}

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

function toDefaultValues(tour?: TourFormProps["tour"]): TourFormInput {
  const emptyTripDetails = normalizeTripDetailsFormDefault(undefined);

  if (!tour || (!tour.title && !tour.id)) {
    return {
      title: "",
      description: "",
      totalCapacity: 30,
      price: 0,
      status: "draft",
      communicationLink: "",
      tourType: undefined,
      destinationId: null,
      locationSection: defaultLocationSection(),
      tripDetails: emptyTripDetails,
    } as TourFormInput;
  }

  const priceUsd = extractTourPriceUsd(tour.costContext);
  const status = tour.lifecycleStatus
    ? apiLifecycleToFormStatus(tour.lifecycleStatus)
    : "draft";

  const rawTrip =
    tour.details?.tripDetails != null && typeof tour.details.tripDetails === "object"
      ? (tour.details.tripDetails as Record<string, unknown>)
      : undefined;

  const tripDetails = normalizeTripDetailsFormDefault(rawTrip);
  const overview =
    tripDetails.overview && typeof tripDetails.overview === "object" && !Array.isArray(tripDetails.overview)
      ? (tripDetails.overview as Record<string, unknown>)
      : {};
  const costCtx =
    tour.costContext && typeof tour.costContext === "object" && !Array.isArray(tour.costContext)
      ? (tour.costContext as Record<string, unknown>)
      : undefined;
  const costLocation = typeof costCtx?.location === "string" ? costCtx.location : "";

  const destId =
    tour && "destinationId" in tour && typeof (tour as TourDto).destinationId === "string"
      ? (tour as TourDto).destinationId
      : null;

  return {
    title: tour.title ?? "",
    description: typeof tour.description === "string" ? tour.description : "",
    totalCapacity: typeof tour.totalCapacity === "number" && tour.totalCapacity > 0 ? tour.totalCapacity : 30,
    price: Number.isFinite(priceUsd) ? priceUsd : 0,
    status,
    communicationLink: typeof tour.communicationLink === "string" ? tour.communicationLink : "",
    tourType: tour.tourType ?? undefined,
    destinationId: destId,
    locationSection: {
      regionId: typeof overview.settingsRegionId === "string" ? overview.settingsRegionId : "",
      mainDestinationId:
        typeof overview.settingsMainDestinationId === "string" ? overview.settingsMainDestinationId : "",
      secondaryDestinationIdsRaw:
        typeof overview.secondaryDestinationIdsRaw === "string" ? overview.secondaryDestinationIdsRaw : "",
      displayLocationOverride: costLocation === "" ? undefined : costLocation,
    },
    tripDetails,
  } as TourFormInput;
}

export function TourForm({ tour, mode = "create", onSubmit, onCancel }: TourFormProps) {
  const tCatalog = useTranslations("tours.catalogErrors");
  const resolvedMode = mode === "edit" || tour?.id ? "edit" : "create";
  const { user } = useAuth();
  const { groupedRegions, allDestinations, isLoading: tourDestinationsLoading } = useTourDestinations();

  const inactiveDestinationOption = useMemo((): SettingsDestinationDto | null => {
    const id =
      tour && "destinationId" in tour && typeof (tour as TourDto).destinationId === "string"
        ? (tour as TourDto).destinationId
        : null;
    if (!id) {
      return null;
    }
    const row = allDestinations.find((d) => d.id === id);
    if (row) {
      return row.isActive ? null : row;
    }
    const name = tour && "destinationName" in tour ? (tour as TourDto).destinationName : null;
    if (name) {
      return {
        id,
        name,
        regionId: "",
        type: null,
        altitudeM: null,
        sortOrder: null,
        isActive: false,
      };
    }
    return null;
  }, [allDestinations, tour]);
  const resolver = useCallback(
    (values: TourFormInput, context: unknown, options: any) => {
      const eventKind = resolveEventKindFromTourContext({
        tourType: values.tourType,
        tripStyles: values.tripDetails?.overview?.tripStyles as string[] | undefined,
      });
      return zodResolver(createTourSchemaForEventKind(eventKind))(values, context, options);
    },
    [],
  );

  const formMethods = useForm<TourFormInput, unknown, TourFormValues>({
    resolver,
    defaultValues: toDefaultValues(tour),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = formMethods;
  const watchedTripStyles = useWatch({ control, name: "tripDetails.overview.tripStyles" }) as
    | string[]
    | undefined;
  const isMountainTour = isMountainTourLike({
    tourType: tour?.tourType ?? undefined,
    tripStyles: watchedTripStyles,
  });
  const eventKind = resolveEventKindFromTourContext({
    tourType: tour?.tourType ?? undefined,
    tripStyles: watchedTripStyles,
  });
  const viewerRole = normalizeFieldUserRole(user?.role);
  const coreConfigById = new Map(getCoreFieldConfigForKind(eventKind).map((row) => [row.id, row]));
  const capacityAccess = resolveFieldAccess(coreConfigById.get("core.totalCapacity"), viewerRole);

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
        const catalogKey = getCatalogErrorMessageKey(err.code);
        if (catalogKey) {
          logTenantCatalogMismatchDev(err);
          setError("root", {
            type: "server",
            message: tCatalog(catalogKey),
          });
          return;
        }
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

        <FormProvider {...formMethods}>
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

          <TourDestinationSelectField
            control={control as never}
            name="destinationId"
            groupedRegions={groupedRegions}
            inactiveSelection={inactiveDestinationOption}
            error={errors.destinationId?.message}
            disabled={isSubmitting || tourDestinationsLoading}
          />

          <TourLocationSection regions={[]} destinations={[]} hideRegionDestinationPickers />

          {capacityAccess.canView ? (
            <FormField label="Total capacity" required error={errors.totalCapacity?.message}>
              <Controller
                control={control}
                name="totalCapacity"
                render={({ field }) => (
                  <PersianNumberInput
                    data-testid="tour-field-capacity"
                    aria-invalid={errors.totalCapacity ? true : undefined}
                    disabled={isSubmitting || !capacityAccess.canEdit}
                    numericMode="integer"
                    value={field.value}
                    onChange={(v) =>
                      field.onChange(v === "" ? Number.NaN : Number.parseInt(v, 10))
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            </FormField>
          ) : null}

          <FormField
            label="Price (USD)"
            required
            description="Stored in costContext totalCost."
            error={errors.price?.message}
          >
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <PersianNumberInput
                  placeholder="0.00"
                  data-testid="tour-field-price"
                  aria-invalid={errors.price ? true : undefined}
                  numericMode="decimal"
                  value={field.value}
                  onChange={(v) => field.onChange(v === "" ? Number.NaN : Number(v))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
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

          <TourCreateTripDetailsFields
            register={register as unknown as UseFormRegister<FieldValues>}
            control={control as unknown as Control<FieldValues>}
            errors={errors as unknown as FieldErrors<FieldValues>}
            isPending={isSubmitting}
            isMountainTour={isMountainTour}
            eventKind={eventKind}
            viewerRole={viewerRole}
            suppressLogisticsMeetingAndReturn
          />

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
        </FormProvider>
      </div>
    </Card>
  );
}

export type { TourFormInput, TourFormValues } from "./tour-schema";
export { TourSchema } from "./tour-schema";
