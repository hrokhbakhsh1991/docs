"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
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

import { FormErrorAlert } from "@/components/forms/FormErrorAlert";
import { ApiError, ForbiddenError } from "@/lib/api-client";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";

import { useCreateTour } from "../hooks/useCreateTour";
import type { TourCreateFormInput, TourCreateModel } from "../models/tourCreateModel";
import { PRIMARY_TRANSPORT_MODES, SOCIAL_PLATFORMS, TOUR_TYPES } from "../models/tourCreateModel";
import { createTourCreateSchemaForEventKind } from "../models/tourCreateModel";
import { isMountainTourLike, resolveEventKindFromTourContext } from "../policies/tour-kind-policy";
import {
  getCoreFieldConfigForKind,
  normalizeFieldUserRole,
  resolveFieldAccess,
} from "../config/tripDetailsFieldConfig";
import { TourCreateTripDetailsFields } from "./tour-create-trip-details-fields";

/** Shown in shell chrome, document title, and main card (keep in sync visually). */
const CREATE_TOUR_PAGE_TITLE = "Create tour";

const breadcrumbItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tours", href: "/tours" },
  { label: "Create" },
] as const;

export function TourCreateClient() {
  const router = useRouter();
  const { mutateAsync, isPending, error: createTourError } = useCreateTour();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const workspaceApiConfigured = toursUseLiveApi();
  const resolver = useCallback(
    (values: TourCreateFormInput, context: unknown, options: any) => {
      const eventKind = resolveEventKindFromTourContext({
        tourType: values.tourType,
        tripStyle: values.tripDetails?.overview?.tripStyle,
      });
      return zodResolver(createTourCreateSchemaForEventKind(eventKind))(values, context, options);
    },
    [],
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TourCreateFormInput, unknown, TourCreateModel>({
    resolver,
    defaultValues: {
      title: "",
      description: "",
      location: "",
      autoAcceptRegistrations: true,
      tourType: undefined,
      primaryTransportMode: undefined,
      durationDays: undefined,
      meetingPoint: "",
      socialLinks: [{ platform: "telegram", url: "" }],
      communicationLink: "",
      tripDetails: {
        itinerary: {
          dayPlans: [],
        },
      },
      capacity: 10,
      price: 0,
      lifecycle_status: "Draft",
    },
  });
  const { fields: socialLinkFields, append: appendSocialLink, remove: removeSocialLink } = useFieldArray({
    control,
    name: "socialLinks",
  });
  const watchedTourType = useWatch({ control, name: "tourType" });
  const watchedTripStyle = useWatch({ control, name: "tripDetails.overview.tripStyle" });
  const isMountainTour = isMountainTourLike({
    tourType: watchedTourType,
    tripStyle: watchedTripStyle,
  });
  const eventKind = resolveEventKindFromTourContext({
    tourType: watchedTourType,
    tripStyle: watchedTripStyle,
  });
  const viewerRole = normalizeFieldUserRole(user?.role);
  const coreConfigById = new Map(getCoreFieldConfigForKind(eventKind).map((row) => [row.id, row]));
  const capacityAccess = resolveFieldAccess(coreConfigById.get("core.capacity"), viewerRole);

  async function handleCreateTourSubmit(values: TourCreateModel) {
    try {
      await mutateAsync(values);
      reset();
      router.push("/tours");
    } catch {
      // Failed requests populate `createTourError` for FormErrorAlert.
    }
  }

  const mutationErrorMessage =
    createTourError != null
      ? createTourError instanceof ForbiddenError ||
          (createTourError instanceof ApiError && createTourError.status === 403)
        ? "You don't have permission to create tours in this workspace. If you think this is a mistake, sign in with an owner or admin account, or ask your workspace owner to update your role."
        : createTourError instanceof Error
          ? createTourError.message
          : "Failed to create tour. Please try again."
      : null;

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

  if (!isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={CREATE_TOUR_PAGE_TITLE}
        title={CREATE_TOUR_PAGE_TITLE}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <Card>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (workspaceApiConfigured && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={CREATE_TOUR_PAGE_TITLE}
        title={CREATE_TOUR_PAGE_TITLE}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <EmptyState
          title="Sign in required"
          description="Your session is missing or expired. Sign in to create tours."
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (isAuthenticated && !isLeaderRole(user?.role)) {
    return (
      <RegisteredWorkspacePage
        documentTitle={CREATE_TOUR_PAGE_TITLE}
        title={CREATE_TOUR_PAGE_TITLE}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <EmptyState
          title="Leader access required"
          description="Only tour leaders can create tours in this workspace."
          action={
            <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
              Back to tours
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (!workspaceApiConfigured) {
    return (
      <RegisteredWorkspacePage
        documentTitle={CREATE_TOUR_PAGE_TITLE}
        title={CREATE_TOUR_PAGE_TITLE}
        breadcrumbItems={[...breadcrumbItems]}
        actions={null}
      >
        <EmptyState
          title="Workspace API not configured"
          description="Set NEXT_PUBLIC_API_URL in your environment to create tours."
          action={
            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
              Back to dashboard
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={CREATE_TOUR_PAGE_TITLE}
      title={CREATE_TOUR_PAGE_TITLE}
      description="Creates a tour via POST /api/v2/tours when the API URL is configured."
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <Card title={CREATE_TOUR_PAGE_TITLE} description="Required fields match the workspace create-tour API (MVP).">
        <CardBody>
          <form
            onSubmit={handleSubmit(handleCreateTourSubmit)}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <FormField label="Title" error={errors.title?.message}>
              <Input autoComplete="off" aria-invalid={errors.title ? true : undefined} {...register("title")} />
            </FormField>

            <FormField label="Description (optional)" error={errors.description?.message}>
              <Textarea rows={3} invalid={Boolean(errors.description)} {...register("description")} />
            </FormField>

            <FormField label="Tour type (optional)" error={errors.tourType?.message}>
              <Select invalid={Boolean(errors.tourType)} {...register("tourType")}>
                <option value="">Select...</option>
                {TOUR_TYPES.map((tourType) => (
                  <option key={tourType} value={tourType}>
                    {tourType === "camp"
                      ? "Camp"
                      : tourType === "mountain"
                        ? "Mountain"
                        : tourType === "city"
                          ? "City"
                          : tourType === "desert"
                            ? "Desert"
                            : "Other"}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Location (optional)" error={errors.location?.message}>
              <Input autoComplete="off" aria-invalid={errors.location ? true : undefined} {...register("location")} />
            </FormField>

            <FormField label="Primary transport mode (optional)" error={errors.primaryTransportMode?.message}>
              <Select invalid={Boolean(errors.primaryTransportMode)} {...register("primaryTransportMode")}>
                <option value="">Select...</option>
                {PRIMARY_TRANSPORT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "bus"
                      ? "Bus"
                      : mode === "train"
                        ? "Train"
                        : mode === "plane"
                          ? "Plane"
                          : mode === "private_car"
                            ? "Private car"
                            : mode === "mixed"
                              ? "Mixed"
                              : "No transport"}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Duration (days) (optional)" error={errors.durationDays?.message}>
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 3"
                autoComplete="off"
                aria-invalid={errors.durationDays ? true : undefined}
                {...register("durationDays")}
              />
            </FormField>

            <FormField label="Meeting point (optional)" error={errors.meetingPoint?.message}>
              <Input
                autoComplete="off"
                aria-invalid={errors.meetingPoint ? true : undefined}
                {...register("meetingPoint")}
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
            />

            <FormField
              label="Registration"
              description="Registration behavior for this tour"
              error={errors.autoAcceptRegistrations?.message}
            >
              <Checkbox
                label="Automatically accept registrations until capacity is full"
                {...register("autoAcceptRegistrations")}
              />
            </FormField>

            <FormField
              label="Social links (optional)"
              description="The first link is treated as the primary communication link for current API compatibility."
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
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder={index === 0 ? "https://t.me/..." : "https://..."}
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
                      Remove
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
                  Add link
                </Button>
              </div>
            </FormField>

            {capacityAccess.canView ? (
              <FormField label="Capacity" error={errors.capacity?.message}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  aria-invalid={errors.capacity ? true : undefined}
                  disabled={isPending || !capacityAccess.canEdit}
                  {...register("capacity")}
                />
              </FormField>
            ) : null}

            <FormField label="Price (USD)" error={errors.price?.message}>
              <Input
                type="number"
                min={0}
                step={0.01}
                aria-invalid={errors.price ? true : undefined}
                {...register("price")}
              />
            </FormField>

            <FormField label="Lifecycle" error={errors.lifecycle_status?.message}>
              <Select invalid={Boolean(errors.lifecycle_status)} {...register("lifecycle_status")}>
                <option value="Draft">Draft</option>
                <option value="Open">Open</option>
              </Select>
            </FormField>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Button type="button" variant="ghost" disabled={isPending} onClick={handleCancelNavigation}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending} loading={isPending}>
                Submit
              </Button>
            </div>
          </form>

          <FormErrorAlert message={mutationErrorMessage} />
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}
