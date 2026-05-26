"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  Button,
  Card,
  CardBody,
  cn,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@tour/ui";

import { DenaliTourEditForm } from "@/components/tours/DenaliTourEditForm";
import { TourForm } from "@/components/tours/TourForm";
import { useTourDetail } from "@/features/tours/hooks/useTourDetail";
import { updateTourDtoFromDenaliWizardForm } from "@/features/tours/edit/updateTourDtoFromDenaliWizardForm";
import {
  getCapabilitiesForProfile,
  normalizeTourFormProfileInput,
} from "@/lib/workspace/workspace-capabilities";
import { resolveDenaliRuleSetFromTemplate } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";
import { useUpdateTour } from "@/features/tours/hooks/useUpdateTour";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { ApiError } from "@/lib/api-client";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";

import { updateTourDtoFromTourFormValues } from "../../tour-ui-mappers";

import styles from "./tour-edit-client.module.css";

export type TourEditInitialSession = {
  userId: string;
  tenantId: string;
  role?: string;
};

export function TourEditClient({
  tourId,
  initialSession = null,
}: {
  tourId: string;
  initialSession?: TourEditInitialSession | null;
}) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi();
  const effectiveRole = isHydrated ? user?.role : user?.role ?? initialSession?.role;
  const leader = isLeaderRole(effectiveRole);
  const sessionReady = isHydrated ? isAuthenticated : Boolean(initialSession);

  const queryEnabled = Boolean(tourId) && liveApi && sessionReady && leader;
  const { tour, isLoading, isFetching, isError, error, refetch } = useTourDetail(tourId, {
    enabled: queryEnabled,
  });
  const updateMutation = useUpdateTour(tourId);
  const tourThemesQuery = useSettingsTourThemes();
  const wizardTemplateQuery = useTenantWizardTemplate();
  const workspaceFormProfile = useMemo(
    () => resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data),
    [wizardTemplateQuery.data],
  );
  const mergedRuleSet = useMemo(
    () => resolveDenaliRuleSetFromTemplate(wizardTemplateQuery.data),
    [wizardTemplateQuery.data],
  );
  const { usesDenaliWizardShell } = useMemo(
    () => getCapabilitiesForProfile(normalizeTourFormProfileInput(workspaceFormProfile)),
    [workspaceFormProfile],
  );

  const errorMessage =
    error instanceof ApiError
      ? error.status === 404
        ? "No tour was found with this id."
        : error.message.trim() || "Could not load tour details. Please try again."
      : "Could not load tour details. Please try again.";

  const lastCrumbLabel = tour?.title?.trim() ? tour.title : "Edit tour";
  const breadcrumbTrail = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tours", href: "/tours" },
    { label: lastCrumbLabel },
  ] as const;

  const shellTitle = usesDenaliWizardShell ? "ویرایش تور" : "Edit tour";
  const documentTitle = tour?.title
    ? usesDenaliWizardShell
      ? `ویرایش ${tour.title}`
      : `Edit ${tour.title}`
    : shellTitle;

  const canEditLifecycle =
    tour != null && (tour.lifecycleStatus === "DRAFT" || tour.lifecycleStatus === "OPEN");

  if (liveApi && !isHydrated && !initialSession) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title="Sign in required"
              description="Your session is missing or expired. Sign in to edit tours."
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isHydrated && isAuthenticated && !leader) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title="Leader access required"
              description="Only users with the leader role can edit tours."
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  Back to tours
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!liveApi && isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title="Workspace API not configured"
              description="Open this app on your workspace host (e.g. ws1-rbac.localhost) to load and edit tours."
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  Back to dashboard
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <LoadingState message="Loading tour…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isError) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <ErrorState title="Could not load tour" message={errorMessage} onRetry={() => void refetch()} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!tour) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title="Tour not found"
              description="No tour exists with this id."
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  Back to tours
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!canEditLifecycle) {
    return (
      <RegisteredWorkspacePage
        documentTitle={documentTitle}
        title={shellTitle}
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title="Tour is read-only"
              description="This tour is closed/cancelled and cannot be edited."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
                >
                  Back to tour
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  const editRefreshing = Boolean(tour && !isLoading && isFetching);

  return (
    <RegisteredWorkspacePage
      documentTitle={documentTitle}
      title={shellTitle}
      description={
        usesDenaliWizardShell
          ? `در حال ویرایش «${tour.title}» — تغییرات با PATCH ذخیره می‌شوند.`
          : `Editing ${tour.title} — changes save via PATCH /api/v2/tours/${tourId}.`
      }
      breadcrumbItems={[...breadcrumbTrail]}
      actions={null}
    >
      <div
        className={cn(styles.contentRoot, editRefreshing ? styles.contentRootRefreshing : undefined)}
        aria-busy={editRefreshing ? true : undefined}
      >
        {editRefreshing ? (
          <span className={styles.liveRegion} aria-live="polite">
            Updating tour data
          </span>
        ) : null}
        {usesDenaliWizardShell ? (
          <DenaliTourEditForm
            tour={tour}
            submitError={updateMutation.error}
            onCancel={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
            onSubmit={async (values, meta) => {
              const updated = await updateMutation.mutateAsync({
                dto: updateTourDtoFromDenaliWizardForm(values, {
                  themeCatalog: tourThemesQuery.data ?? [],
                  formProfile: workspaceFormProfile,
                  ruleSet: mergedRuleSet,
                  patchIntent: meta.intent,
                }),
                mergeCostFrom: tour.costContext ?? null,
              });
              if (!updated) {
                throw new Error("Tour not found");
              }
              router.push(`/tours/${encodeURIComponent(tourId)}`);
            }}
          />
        ) : (
          <TourForm
            mode="edit"
            tour={tour}
            themeCatalogForFormProfile={tourThemesQuery.data ?? []}
            onCancel={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
            onSubmit={async (values, meta) => {
              const updated = await updateMutation.mutateAsync({
                dto: updateTourDtoFromTourFormValues(
                  values,
                  tour,
                  tourThemesQuery.data ?? [],
                  meta?.resolvedFormProfile,
                ),
                mergeCostFrom: tour.costContext ?? null,
              });
              if (!updated) {
                throw new Error("Tour not found");
              }
              router.push(`/tours/${encodeURIComponent(tourId)}`);
            }}
          />
        )}
      </div>
    </RegisteredWorkspacePage>
  );
}
