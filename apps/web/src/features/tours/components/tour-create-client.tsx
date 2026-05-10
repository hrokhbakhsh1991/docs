"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type UseFormRegister,
} from "react-hook-form";

import {
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  Select,
  Textarea,
} from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import {
  getCatalogErrorMessageKey,
  logTenantCatalogMismatchDev,
} from "@/lib/errors/tenant-catalog-tour-errors";
import { ApiError, ForbiddenError } from "@/lib/api-client";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";

import { buildToursNewValidationMessages } from "../i18n/build-tours-new-validation-messages";
import { useCreateTour } from "../hooks/useCreateTour";
import type { TourCreateFormInput, TourCreateModel, TourType, TourTransportMode, SocialPlatform } from "../models/tourCreateModel";
import { SOCIAL_PLATFORMS, TOUR_TRANSPORT_MODES, TOUR_TYPES } from "../models/tourCreateModel";
import { createTourCreateSchemaForEventKind } from "../models/tourCreateModel";
import { isMountainTourLike, resolveEventKindFromTourContext } from "../policies/tour-kind-policy";
import {
  getCoreFieldConfigForKind,
  normalizeFieldUserRole,
  resolveFieldAccess,
} from "../config/tripDetailsFieldConfig";
import { uiLocaleDigits } from "../../../lib/number-utils";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";

import { TourCreateTripDetailsFields } from "./tour-create-trip-details-fields";
import { TourDestinationSelectField } from "./tour-destination-select-field";
import { TourLocationSection } from "./tour-location-section";

function enrichTourCreateFromDestinationSelection(
  values: TourCreateModel,
  allDestinations: SettingsDestinationDto[],
): TourCreateModel {
  if (values.destinationId == null || values.destinationId === "") {
    return values;
  }
  const hit = allDestinations.find((d) => d.id === values.destinationId);
  if (!hit) {
    return values;
  }
  return {
    ...values,
    locationSection: {
      ...values.locationSection,
      regionId: hit.regionId,
      mainDestinationId: hit.id,
    },
  };
}

const TOUR_TYPE_LABEL_KEYS: Record<TourType, string> = {
  mountain: "tourTypeMountain",
  city: "tourTypeCity",
  desert: "tourTypeDesert",
  nature: "tourTypeNature",
  cultural: "tourTypeCultural",
};

const TRANSPORT_LABEL_KEYS: Record<TourTransportMode, string> = {
  bus: "transportBus",
  train: "transportTrain",
  plane: "transportPlane",
  private_car: "transportPrivateCar",
};

const SOCIAL_PLATFORM_LABEL_KEYS: Record<SocialPlatform, string> = {
  telegram: "socialPlatformTelegram",
  whatsapp: "socialPlatformWhatsapp",
  instagram: "socialPlatformInstagram",
  website: "socialPlatformWebsite",
  other: "socialPlatformOther",
};

export function TourCreateClient() {
  const t = useTranslations("tours.new");
  const tCatalog = useTranslations("tours.catalogErrors");
  const locale = useLocale();
  const router = useRouter();
  const { mutateAsync, isPending, error: createTourError } = useCreateTour();
  const tourThemesQuery = useSettingsTourThemes();
  const { groupedRegions, allDestinations, isLoading: tourDestinationsLoading } = useTourDestinations();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const workspaceApiConfigured = toursUseLiveApi();

  const validationMessages = useMemo(() => buildToursNewValidationMessages(t), [t]);

  const resolver = useCallback(
    (values: TourCreateFormInput, context: unknown, options: any) => {
      const eventKind = resolveEventKindFromTourContext({
        tourType: values.tourType,
        tripStyles: values.tripDetails?.overview?.tripStyles as string[] | undefined,
      });
      return zodResolver(createTourCreateSchemaForEventKind(eventKind, validationMessages))(
        values,
        context,
        options,
      );
    },
    [validationMessages],
  );

  const formMethods = useForm<TourCreateFormInput, unknown, TourCreateModel>({
    resolver,
    defaultValues: {
      title: "",
      description: "",
      locationSection: {
        regionId: "",
        mainDestinationId: "",
        secondaryDestinationIdsRaw: "",
        displayLocationOverride: "",
      },
      destinationId: null,
      autoAcceptRegistrations: true,
      tourType: undefined,
      transportModes: [],
      socialLinks: [{ platform: "telegram", url: "" }],
      communicationLink: "",
      tripDetails: {
        itinerary: {
          dayPlans: [],
        },
        logistics: {
          meetingPoint: "",
          returnPoint: "",
        },
      },
      capacity: 10,
      price: 0,
      lifecycle_status: "Draft",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = formMethods;
  const { fields: socialLinkFields, append: appendSocialLink, remove: removeSocialLink } = useFieldArray({
    control,
    name: "socialLinks",
  });
  const watchedTourType = useWatch({ control, name: "tourType" });
  const watchedTripStyles = useWatch({ control, name: "tripDetails.overview.tripStyles" }) as
    | string[]
    | undefined;
  const isMountainTour = isMountainTourLike({
    tourType: watchedTourType,
    tripStyles: watchedTripStyles,
  });
  const eventKind = resolveEventKindFromTourContext({
    tourType: watchedTourType,
    tripStyles: watchedTripStyles,
  });
  const viewerRole = normalizeFieldUserRole(user?.role);
  const coreConfigById = new Map(getCoreFieldConfigForKind(eventKind).map((row) => [row.id, row]));
  const capacityAccess = resolveFieldAccess(coreConfigById.get("core.capacity"), viewerRole);

  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbTours"), href: "/tours" },
        { label: t("breadcrumbCreate") },
      ] as const,
    [t],
  );

  async function handleCreateTourSubmit(values: TourCreateModel) {
    try {
      await mutateAsync({
        ...enrichTourCreateFromDestinationSelection(values, allDestinations),
        themeCatalog: tourThemesQuery.data ?? [],
      });
      reset();
      router.push("/tours");
    } catch {
      // Failed requests populate `createTourError` for FormErrorAlert.
    }
  }

  const mutationErrorMessage = useMemo(() => {
    if (createTourError == null) {
      return null;
    }
    if (
      createTourError instanceof ForbiddenError ||
      (createTourError instanceof ApiError && createTourError.status === 403)
    ) {
      return t("mutationForbidden");
    }
    if (createTourError instanceof ApiError) {
      const catalogKey = getCatalogErrorMessageKey(createTourError.code);
      if (catalogKey) {
        logTenantCatalogMismatchDev(createTourError);
        return tCatalog(catalogKey);
      }
      return createTourError.message;
    }
    if (createTourError instanceof Error) {
      return createTourError.message;
    }
    return t("mutationGenericFailed");
  }, [createTourError, t, tCatalog]);

  /** Back when possible; `replace("/tours")` only if no prior history entry or `back` throws. */
  function handleCancelNavigation() {
    if (typeof window !== "undefined" && window.history.length <= 1) {
      void router.replace("/tours");
      return;
    }
    try {
      router.back();
    } catch {
      void router.replace("/tours");
    }
  }

  const pageTitle = t("pageTitle");

  if (!isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={pageTitle}
        title={pageTitle}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <Card>
          <CardBody>
            <LoadingState message={t("loadingSession")} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (workspaceApiConfigured && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={pageTitle}
        title={pageTitle}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <EmptyState
          title={t("emptySignInTitle")}
          description={t("emptySignInDescription")}
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              {t("emptySignInButton")}
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (isAuthenticated && !isLeaderRole(user?.role)) {
    return (
      <RegisteredWorkspacePage
        documentTitle={pageTitle}
        title={pageTitle}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <EmptyState
          title={t("emptyLeaderTitle")}
          description={t("emptyLeaderDescription")}
          action={
            <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
              {t("emptyLeaderButton")}
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (!workspaceApiConfigured) {
    return (
      <RegisteredWorkspacePage
        documentTitle={pageTitle}
        title={pageTitle}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <EmptyState
          title={t("emptyApiTitle")}
          description={t("emptyApiDescription")}
          action={
            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
              {t("emptyApiButton")}
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={pageTitle}
      title={pageTitle}
      description={t("pageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <Card title={pageTitle} description={t("cardDescription")}>
        <CardBody>
          <FormProvider {...formMethods}>
            <form
              onSubmit={handleSubmit(handleCreateTourSubmit)}
              noValidate
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
            <FormField
              label={t("fieldTitle")}
              description={t("fieldTitleDescription")}
              error={errors.title?.message}
            >
              <Input
                autoComplete="off"
                placeholder={t("placeholderTitle")}
                maxLength={120}
                aria-invalid={errors.title ? true : undefined}
                {...register("title")}
              />
            </FormField>

            <FormField
              label={t("fieldDescription")}
              description={t("fieldDescriptionFullPage")}
              error={errors.description?.message}
            >
              <Textarea rows={3} invalid={Boolean(errors.description)} {...register("description")} />
            </FormField>

            <FormField
              label={t("fieldTourType")}
              description={t("fieldTourTypeDescription")}
              error={errors.tourType?.message}
            >
              <Select invalid={Boolean(errors.tourType)} {...register("tourType")}>
                <option value="">{t("selectPlaceholder")}</option>
                {TOUR_TYPES.map((tourType) => (
                  <option key={tourType} value={tourType}>
                    {t(TOUR_TYPE_LABEL_KEYS[tourType])}
                  </option>
                ))}
              </Select>
            </FormField>

            <TourDestinationSelectField
              control={control as never}
              name="destinationId"
              groupedRegions={groupedRegions}
              inactiveSelection={null}
              error={errors.destinationId?.message as string | undefined}
              disabled={isPending || tourDestinationsLoading}
            />

            <TourLocationSection regions={[]} destinations={[]} hideRegionDestinationPickers />

            <FormField
              label={t("fieldTransport")}
              description={t("fieldTransportDescription")}
              error={errors.transportModes?.message}
            >
              <Controller
                name="transportModes"
                control={control}
                render={({ field }) => (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                    role="group"
                    aria-label={t("fieldTransport")}
                  >
                    {TOUR_TRANSPORT_MODES.map((mode) => (
                      <Checkbox
                        key={mode}
                        label={t(TRANSPORT_LABEL_KEYS[mode])}
                        checked={(field.value ?? []).includes(mode)}
                        disabled={isPending}
                        onChange={(e) => {
                          const prev = field.value ?? [];
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.add(mode);
                          } else {
                            next.delete(mode);
                          }
                          field.onChange([...next]);
                        }}
                      />
                    ))}
                  </div>
                )}
              />
            </FormField>

            <TourCreateTripDetailsFields
              register={register as unknown as UseFormRegister<FieldValues>}
              control={control as unknown as Control<FieldValues>}
              errors={errors as unknown as FieldErrors<FieldValues>}
              isPending={isPending}
              isMountainTour={isMountainTour}
              eventKind={eventKind}
              viewerRole={viewerRole}
              suppressLogisticsMeetingAndReturn
            />

            <FormField
              label={t("fieldRegistration")}
              description={t("fieldRegistrationDescription")}
              error={errors.autoAcceptRegistrations?.message}
            >
              <Checkbox label={t("checkboxAutoAccept")} {...register("autoAcceptRegistrations")} />
            </FormField>

            <FormField
              label={t("fieldSocialLinks")}
              description={t("fieldSocialLinksDescription")}
              error={errors.socialLinks?.message}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {socialLinkFields.map((field, index) => (
                  <div key={field.id} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Select
                      invalid={Boolean(errors.socialLinks?.[index]?.platform)}
                      style={{ minWidth: "10rem" }}
                      {...register(`socialLinks.${index}.platform`)}
                    >
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {t(SOCIAL_PLATFORM_LABEL_KEYS[platform])}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder={
                        index === 0
                          ? uiLocaleDigits(t("placeholderSocialUrlPrimary"), locale)
                          : uiLocaleDigits(t("placeholderSocialUrlOther"), locale)
                      }
                      autoComplete="off"
                      aria-invalid={errors.socialLinks?.[index]?.url ? true : undefined}
                      style={{ flex: 1, minWidth: "14rem" }}
                      {...register(`socialLinks.${index}.url`)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeSocialLink(index)}
                      disabled={isPending || socialLinkFields.length <= 1}
                    >
                      {t("removeLinkButton")}
                    </Button>
                  </div>
                ))}
                {errors.socialLinks &&
                  Array.isArray(errors.socialLinks) &&
                  errors.socialLinks.map((socialLinkError, index) => {
                    const platformError = socialLinkError?.platform?.message;
                    const urlError = socialLinkError?.url?.message;
                    if (!platformError && !urlError) return null;
                    return (
                      <div key={`social-link-error-${index}`} style={{ color: "var(--color-danger-600)" }}>
                        {platformError ?? urlError}
                      </div>
                    );
                  })}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => appendSocialLink({ platform: "telegram", url: "" })}
                  style={{ alignSelf: "flex-start" }}
                >
                  {t("addLinkButton")}
                </Button>
              </div>
            </FormField>

            {capacityAccess.canView ? (
              <FormField label={t("fieldCapacity")} error={errors.capacity?.message}>
                <Controller
                  name="capacity"
                  control={control}
                  render={({ field }) => (
                    <PersianNumberInput
                      aria-invalid={errors.capacity ? true : undefined}
                      disabled={isPending || !capacityAccess.canEdit}
                      numericMode="integer"
                      value={(field.value as string | number | undefined) ?? ""}
                      onChange={(v) => field.onChange(v)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  )}
                />
              </FormField>
            ) : null}

            <FormField label={t("fieldPrice")} error={errors.price?.message}>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <PersianNumberInput
                    aria-invalid={errors.price ? true : undefined}
                    numericMode="decimal"
                    value={(field.value as string | number | undefined) ?? ""}
                    onChange={(v) => field.onChange(v)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            </FormField>

            <FormField label={t("fieldLifecycle")} error={errors.lifecycle_status?.message}>
              <Select invalid={Boolean(errors.lifecycle_status)} {...register("lifecycle_status")}>
                <option value="Draft">{t("lifecycleDraft")}</option>
                <option value="Open">{t("lifecycleOpen")}</option>
              </Select>
            </FormField>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Button type="button" variant="ghost" disabled={isPending} onClick={handleCancelNavigation}>
                {t("cancelButton")}
              </Button>
              <Button type="submit" variant="primary" disabled={isPending} loading={isPending}>
                {t("submitButton")}
              </Button>
            </div>
          </form>
          </FormProvider>

          <FormErrorAlert message={mutationErrorMessage} />
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}
