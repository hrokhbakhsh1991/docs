"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

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
  const tEdit = useTranslations("tours.edit");
  const tList = useTranslations("tours.list");
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

  const shellTitle = tEdit("pageTitle");
  const documentTitle = tour?.title?.trim()
    ? tEdit("pageTitleWithTour", { title: tour.title })
    : shellTitle;

  const breadcrumbItems = useMemo(
    () => [
      { label: tList("breadcrumbHome"), href: "/dashboard" },
      { label: tList("breadcrumbTours"), href: "/tours" },
      {
        label: tour?.title?.trim() ? tour.title : tEdit("breadcrumbCurrent"),
      },
    ],
    [tEdit, tList, tour?.title],
  );

  const toursErrorMessage = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          return tEdit("errorNotFound");
        }
        return err.message.trim() || tEdit("errorLoadGeneric");
      }
      return tEdit("errorLoadConnection");
    },
    [tEdit],
  );

  const pageDescription = useMemo(() => {
    if (!tour?.title?.trim()) {
      return undefined;
    }
    return usesDenaliWizardShell
      ? tEdit("pageDescription", { title: tour.title })
      : tEdit("pageDescriptionClassic", { title: tour.title });
  }, [tEdit, tour?.title, usesDenaliWizardShell]);

  const canEditLifecycle =
    tour != null && (tour.lifecycleStatus === "DRAFT" || tour.lifecycleStatus === "OPEN");

  if (liveApi && !isHydrated && !initialSession) {
    return (
      <RegisteredWorkspacePage
        documentTitle={shellTitle}
        title={shellTitle}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <LoadingState message={tEdit("loadingSession")} />
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
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tEdit("signInRequired")}
              description={tEdit("signInRequiredDesc")}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  {tEdit("signIn")}
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
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tEdit("leaderAccessRequired")}
              description={tEdit("leaderAccessRequiredDesc")}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  {tEdit("backToTours")}
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
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tEdit("apiNotConfiguredTitle")}
              description={tEdit("apiNotConfiguredDesc")}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  {tEdit("backToDashboard")}
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
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <LoadingState message={tEdit("loadingTour")} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isError) {
    return (
      <RegisteredWorkspacePage
        documentTitle={documentTitle}
        title={shellTitle}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <ErrorState
              title={tEdit("errorLoadTitle")}
              message={toursErrorMessage(error)}
              onRetry={() => void refetch()}
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!tour) {
    return (
      <RegisteredWorkspacePage
        documentTitle={documentTitle}
        title={shellTitle}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tEdit("tourNotFoundTitle")}
              description={tEdit("tourNotFoundDesc")}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  {tEdit("backToTours")}
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
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tEdit("readOnlyTitle")}
              description={tEdit("readOnlyDesc")}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
                >
                  {tEdit("backToTour")}
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
      description={pageDescription}
      breadcrumbItems={breadcrumbItems}
      actions={null}
    >
      <div
        className={cn(styles.contentRoot, editRefreshing ? styles.contentRootRefreshing : undefined)}
        aria-busy={editRefreshing ? true : undefined}
      >
        {editRefreshing ? (
          <span className={styles.liveRegion} aria-live="polite">
            {tEdit("updatingLive")}
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
