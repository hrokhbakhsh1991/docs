"use client";

import type { TourDto, TourFormProfile, TourLifecycleStatus, TourType } from "@repo/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
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

import { Alert, Button, Card, FormField, Input, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { ApiError } from "@/lib/api-client";
import { ErrorRegistry } from "@/lib/errors/error-registry";
import { getCatalogErrorMessageKey, logTenantCatalogMismatchDev } from "@/lib/errors/tenant-catalog-tour-errors";
import { TourCreateTripDetailsFields } from "@/features/tours/components/tour-create-trip-details-fields";
import { TourDestinationSelectField } from "@/features/tours/components/tour-destination-select-field";
import { TourLocationSection } from "@/features/tours/components/tour-location-section";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";
import {
  getCoreFieldConfigForProfile,
} from "@/features/tours/config/tripDetailsFieldConfigAdapter";
import { normalizeFieldUserRole, resolveFieldAccess } from "@/features/tours/config/tripDetailsFieldConfig";
import { normalizeTripDetailsFormDefault } from "@/features/tours/models/tourTripDetails.schema";
import {
  resetTourFlatFormProfileValidationFlags,
  setTourFlatFormProfileValidationFlags,
  tourFormProfileToWizardValidationFlags,
} from "@/features/tours/wizard/schemas/classic/tourCreateValidationPolicy";
import {
  dualClassificationForEditForm,
  domainProfileFromEditFormValues,
} from "@/features/tours/domain/tourDomainProfileAdapters";
import {
  emitEditDomainClassificationDrift,
  emitEditSaveHttpFailure,
} from "@/features/tours/observability/tourProfileObservability";
import type { ThemeRowForProfile } from "@/features/tours/wizard/tourWizardProfileResolve";
import { useAuth } from "@/lib/auth/auth-context";
import { useUnifiedTourDomainProfileForEditResolver } from "@/lib/config/feature-flags";

import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { getCapabilitiesForProfile } from "@/lib/workspace/workspace-capabilities";

import { apiLifecycleToFormStatus } from "./tour-lifecycle";
import { extractTourPriceUsd } from "./formatters";
import { DenaliGatheringPointsWidget } from "@/features/tours/wizard/denali/components/DenaliGatheringPointsWidget";
import { TourEditDenaliGeoSection } from "./TourEditDenaliGeoSection";
import { TourEditLeadersParticipationSection } from "./TourEditLeadersParticipationSection";
import { TourEditPeakExperienceSection } from "./TourEditPeakExperienceSection";
import { TourPublishStatusField } from "./TourPublishStatusField";
import type { TourFormLifecycleStatus } from "./tour-lifecycle";
import { DENALI_FIELD_HINTS } from "@/features/tours/wizard/denali/denaliFieldHints";
import { createTourSchemaForProfile, type TourFormInput, type TourFormValues } from "./tour-schema";
import {
  collectTourFormValidationIssues,
  scrollTourFormToFirstError,
  type TourFormErrorLabelContext,
} from "./tourFormValidationSummary";

import styles from "./TourForm.module.css";

function defaultLocationSection(): TourFormInput["locationSection"] {
  return {
    regionId: "",
    mainDestinationId: "",
    secondaryDestinationIdsRaw: "",
    displayLocationOverride: "",
  };
}

/**
 * Extracts the primary theme id from a `TourFormInput`. Matches the watched form
 * extraction in `mainTourThemeIdForProfile` (first non-empty trimmed string).
 */
function extractMainTourThemeIdFromValues(values: TourFormInput): string | undefined {
  const ids = (values.tripDetails as { overview?: { tourThemeIds?: unknown } } | undefined)?.overview
    ?.tourThemeIds;
  if (!Array.isArray(ids) || ids.length === 0) return undefined;
  const first = ids[0];
  if (typeof first !== "string") return undefined;
  const trimmed = first.trim();
  return trimmed === "" ? undefined : trimmed;
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

export type TourFormSubmitMeta = {
  resolvedFormProfile: TourFormProfile;
};

export type TourFormProps = {
  tour?: Partial<TourDto> & {
    id?: string;
    lifecycleStatus?: TourLifecycleStatus;
    acceptedCount?: number;
  };
  mode?: "create" | "edit";
  onSubmit: (values: TourFormValues, meta?: TourFormSubmitMeta) => void | Promise<void>;
  onCancel?: () => void;
  /** When set with edit mode, enables theme-derived profile strip on save and flat-form validation flags. */
  themeCatalogForFormProfile?: readonly ThemeRowForProfile[];
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

export function TourForm({
  tour,
  mode = "create",
  onSubmit,
  onCancel,
  themeCatalogForFormProfile,
}: TourFormProps) {
  const tCatalog = useTranslations("tours.catalogErrors");
  const tNew = useTranslations("tours.new");
  const tDenali = useTranslations("tours.denali");
  const tForm = useTranslations("tours.form");
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
  /**
   * Edit Zod resolver uses `TourDomainProfile` from the theme catalog when available, so
   * the trip-details schema matches the workspace theme's `TourFormProfile` even when commercial
   * `tourType` disagrees (e.g. cinema profile on a mountain `tourType`).
   *
   * Phase P7 (promptq.md) flipped `useUnifiedTourDomainProfileForEditResolver` to ON by
   * default. The resolver below always routes through `domainProfileFromEditFormValues`;
   * the flag now only annotates observability events and engages the legacy fallback when
   * the `LEGACY_EDIT_RESOLVER_ENABLED` kill switch is set (single-cycle escape hatch,
   * scheduled for removal in Phase P8 along with `legacyEventKindFromEditFormValues`).
   */
  const unifiedEditResolverEnabled = useUnifiedTourDomainProfileForEditResolver();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const workspaceFormProfile = useMemo(
    () => resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data),
    [wizardTemplateQuery.data],
  );
  const workspaceCapabilities = useMemo(
    () => getCapabilitiesForProfile(workspaceFormProfile),
    [workspaceFormProfile],
  );
  const resolver = useCallback(
    (values: TourFormInput, context: unknown, options: any) => {
      const tripStyles = values.tripDetails?.overview?.tripStyles as string[] | undefined;
      const themeProfile = domainProfileFromEditFormValues({
        themeCatalog: themeCatalogForFormProfile,
        tourType: values.tourType,
        mainTourThemeId: extractMainTourThemeIdFromValues(values),
        tripStyles,
      });
      const profileForSchema = workspaceCapabilities.requiresGeoPublish
        ? workspaceFormProfile
        : themeProfile;
      return zodResolver(createTourSchemaForProfile(profileForSchema))(values, context, options);
    },
    [themeCatalogForFormProfile, workspaceFormProfile, workspaceCapabilities],
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
  const watchedTourThemeIds = useWatch({ control, name: "tripDetails.overview.tourThemeIds" }) as
    | string[]
    | undefined;
  const watchedTourTypeField = useWatch({ control, name: "tourType" }) as TourType | undefined;

  const mainTourThemeIdForProfile = useMemo(() => {
    if (!Array.isArray(watchedTourThemeIds) || watchedTourThemeIds.length === 0) {
      return undefined;
    }
    const first = watchedTourThemeIds[0];
    return typeof first === "string" ? first.trim() : undefined;
  }, [watchedTourThemeIds]);

  /**
   * Dual classification for Edit when the theme catalog is loaded: canonical `TourDomainProfile`
   * plus legacy vs projected `EventKind` for the trip-details matrix and drift telemetry.
   * `resolvedFormProfileForEdit` stays undefined before the catalog loads so existing reset logic
   * for validation flags is unchanged.
   */
  const editClassification = useMemo(() => {
    if (resolvedMode !== "edit" || !themeCatalogForFormProfile) {
      return undefined;
    }
    return dualClassificationForEditForm({
      themeCatalog: themeCatalogForFormProfile,
      tourType: watchedTourTypeField,
      mainTourThemeId: mainTourThemeIdForProfile,
      tripStyles: watchedTripStyles,
    });
  }, [
    resolvedMode,
    themeCatalogForFormProfile,
    watchedTourTypeField,
    mainTourThemeIdForProfile,
    watchedTripStyles,
  ]);

  const resolvedFormProfileForEdit: TourFormProfile | undefined =
    editClassification?.domainProfile;
  const resolvedEditCapabilities = useMemo(
    () =>
      resolvedFormProfileForEdit != null
        ? getCapabilitiesForProfile(resolvedFormProfileForEdit)
        : null,
    [resolvedFormProfileForEdit],
  );
  const showDenaliPublishGeoSection =
    workspaceCapabilities.requiresGeoPublish ||
    (resolvedEditCapabilities?.requiresGeoPublish ?? false);
  const showDenaliAdminFields =
    workspaceCapabilities.usesDenaliWizardShell ||
    (resolvedEditCapabilities?.usesDenaliWizardShell ?? false);
  const currentTourId = tour && "id" in tour ? (tour as TourDto).id : undefined;

  useEffect(() => {
    if (!editClassification || editClassification.agrees) {
      return;
    }
    emitEditDomainClassificationDrift({
      tour_id: currentTourId,
      domain_profile: editClassification.domainProfile,
      legacy_event_kind: editClassification.legacyEventKind,
      projected_event_kind: editClassification.projectedEventKind,
      unified_edit_resolver_enabled: unifiedEditResolverEnabled,
    });
  }, [currentTourId, editClassification, unifiedEditResolverEnabled]);

  useLayoutEffect(() => {
    if (resolvedFormProfileForEdit == null) {
      resetTourFlatFormProfileValidationFlags();
      return () => {
        resetTourFlatFormProfileValidationFlags();
      };
    }
    setTourFlatFormProfileValidationFlags(tourFormProfileToWizardValidationFlags(resolvedFormProfileForEdit));
    return () => {
      resetTourFlatFormProfileValidationFlags();
    };
  }, [resolvedFormProfileForEdit]);

  const viewerRole = normalizeFieldUserRole(user?.role);
  const coreConfigById = resolvedFormProfileForEdit
    ? new Map(getCoreFieldConfigForProfile(resolvedFormProfileForEdit).map((row) => [row.id, row]))
    : new Map();
  const capacityAccess = resolveFieldAccess(coreConfigById.get("core.totalCapacity"), viewerRole);

  useEffect(() => {
    reset(toDefaultValues(tour));
  }, [tour, reset]);

  const errorLabelContext = useMemo(
    (): TourFormErrorLabelContext => ({
      tNew,
      tDenali,
      tForm,
    }),
    [tNew, tDenali, tForm],
  );

  const validationIssues = useMemo(
    () => collectTourFormValidationIssues(errors, errorLabelContext),
    [errors, errorLabelContext],
  );

  const onInvalid = useCallback(
    (fieldErrors: typeof errors) => {
      const issues = collectTourFormValidationIssues(fieldErrors, errorLabelContext);
      scrollTourFormToFirstError(issues);
    },
    [errorLabelContext],
  );

  async function submitValid(data: TourFormValues) {
    try {
      const profileForSave = workspaceCapabilities.requiresGeoPublish
        ? workspaceFormProfile
        : resolvedFormProfileForEdit;
      await onSubmit(
        data,
        profileForSave != null ? { resolvedFormProfile: profileForSave } : undefined,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        emitEditSaveHttpFailure({
          tour_id: currentTourId,
          http_status: 400,
          error_code: err.code,
          error_message: err.message,
          domain_profile: resolvedFormProfileForEdit,
          unified_edit_resolver_enabled: unifiedEditResolverEnabled,
        });
        const catalogKey = getCatalogErrorMessageKey(err.code);
        if (catalogKey) {
          logTenantCatalogMismatchDev(err);
          setError("root", {
            type: "server",
            message: tCatalog(catalogKey),
          });
          return;
        }
        const registryEntry = err.code ? ErrorRegistry[err.code] : undefined;
        if (registryEntry) {
          setError("root", {
            type: "server",
            message: registryEntry.message,
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
      description="Tour fields; submits to the workspace API on your tenant host."
    >
      <div className={styles.inner}>
        {isSubmitted && validationIssues.length > 0 ? (
          <Alert
            variant="error"
            title={tForm("validationSummaryTitle")}
            role="alert"
            data-testid="tour-form-validation-summary"
          >
            <p style={{ margin: "0 0 0.5rem" }}>{tForm("validationSummaryIntro")}</p>
            <ul className={styles.fieldErrorList} id="tour-form-field-error-list">
              {validationIssues.map((issue) => (
                <li key={issue.path}>
                  <strong>{issue.label}</strong>: {issue.message}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {errors.root?.message ? (
          <Alert variant="error" title={tForm("couldNotSaveTitle")} role="alert">
            {errors.root.message}
          </Alert>
        ) : null}

        <FormProvider {...formMethods}>
        <form className={styles.form} onSubmit={handleSubmit(submitValid, onInvalid)} noValidate>
          <FormField
            label="Title"
            required
            description={showDenaliPublishGeoSection ? DENALI_FIELD_HINTS.title : undefined}
            error={errors.title?.message}
          >
            <Input
              placeholder={showDenaliPublishGeoSection ? "مثلاً صعود زمستانه به دماوند" : "e.g. Sunset kayak tour"}
              autoComplete="off"
              data-testid="tour-field-name"
              data-field-path="title"
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

          <TourLocationSection
            regions={[]}
            destinations={[]}
            hideRegionDestinationPickers
            hideLogisticsMeetingAndReturn={showDenaliPublishGeoSection}
          />

          {showDenaliPublishGeoSection ? (
            <>
              <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />
              <TourEditDenaliGeoSection
                control={control as never}
                errors={errors as never}
              />
            </>
          ) : null}

          {showDenaliAdminFields ? (
            <TourEditPeakExperienceSection control={control as never} errors={errors as never} />
          ) : null}

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

          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <TourPublishStatusField
                value={(field.value as TourFormLifecycleStatus) ?? "draft"}
                onChange={field.onChange}
                disabled={isSubmitting}
                allowArchived={resolvedMode === "edit"}
                data-testid="tour-field-status"
              />
            )}
          />

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

          {showDenaliAdminFields ? (
            <TourEditLeadersParticipationSection disabled={isSubmitting} />
          ) : null}

          <TourCreateTripDetailsFields
            register={register as unknown as UseFormRegister<FieldValues>}
            control={control as unknown as Control<FieldValues>}
            errors={errors as unknown as FieldErrors<FieldValues>}
            isPending={isSubmitting}
            formProfile={resolvedFormProfileForEdit}
            viewerRole={viewerRole}
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
