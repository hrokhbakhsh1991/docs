"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { ApiError } from "@/lib/api-client";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { registrationsUseLiveApi } from "@/lib/services/registrations.service";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useTourDetail } from "@/features/tours/hooks/useTourDetail";
import { useConvertWaitlistItem } from "@/features/registrations/hooks/useConvertWaitlistItem";
import { useTourRegistrations } from "@/features/registrations/hooks/useTourRegistrations";
import { useTourWaitlist } from "@/features/registrations/hooks/useTourWaitlist";
import { useUpdateRegistrationPayment } from "@/features/registrations/hooks/useUpdateRegistrationPayment";
import { useUpdateRegistrationStatus } from "@/features/registrations/hooks/useUpdateRegistrationStatus";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  ErrorState,
  LoadingState,
  type BreadcrumbItem,
} from "@tour/ui";

import { WorkspaceSubnav } from "./WorkspaceSubnav";
import { TourWorkspaceProvider } from "./tour-workspace-context";
import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";
import {
  isTourReadOnlyForWorkspace,
  workspaceReadOnlyBannerText,
} from "./tour-workspace-ui";

import stateStyles from "./tour-workspace-state.module.css";
import styles from "./tour-workspace.module.css";

const copy = TOUR_WORKSPACE_COPY.page;

export type TourWorkspaceLayoutClientProps = {
  tourId: string;
  children: ReactNode;
};

export function TourWorkspaceLayoutClient({ tourId, children }: TourWorkspaceLayoutClientProps) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const leader = isLeaderRole(user?.role);
  const hasTenantId = Boolean(user?.tenantId?.trim());
  const liveApi = toursUseLiveApi() && registrationsUseLiveApi();
  const tourEnabled =
    Boolean(tourId) && toursUseLiveApi() && isHydrated && isAuthenticated && leader && hasTenantId;
  const dataEnabled =
    Boolean(tourId) && liveApi && isHydrated && isAuthenticated && leader && hasTenantId;

  const {
    tour,
    isLoading: tourLoading,
    isFetching: tourFetching,
    isError: tourIsError,
    error: tourError,
    refetch: refetchTour,
  } = useTourDetail(tourId, { enabled: tourEnabled });
  const {
    registrations,
    isLoading: regLoading,
    isFetching: regFetching,
    isError: regIsError,
    refetch: refetchRegistrations,
  } = useTourRegistrations(tourId, { enabled: dataEnabled });
  const {
    waitlist,
    isLoading: waitLoading,
    isFetching: waitFetching,
    isError: waitIsError,
    refetch: refetchWaitlist,
  } = useTourWaitlist(tourId, { enabled: dataEnabled });

  const statusMutation = useUpdateRegistrationStatus(tourId);
  const paymentMutation = useUpdateRegistrationPayment(tourId);
  const convertMutation = useConvertWaitlistItem(tourId);

  const tourErrorMessage =
    tourError instanceof ApiError
      ? tourError.status === 404
        ? copy.loadTourNotFound
        : tourError.message.trim() || copy.loadTourFallback
      : copy.loadTourFallback;

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: copy.breadcrumbHome, href: "/dashboard" },
      { label: copy.breadcrumbTours, href: "/tours" },
      { label: tour?.title ?? copy.tourFallback },
      { label: copy.breadcrumbWorkspace },
    ],
    [tour?.title],
  );

  const readOnly = tour != null && isTourReadOnlyForWorkspace(tour.lifecycleStatus);

  if (toursUseLiveApi() && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <LoadingState message={copy.loadingSession} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title={copy.signInTitle}
              description={copy.signInDescription}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  {copy.signInButton}
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
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title={copy.leaderRequiredTitle}
              description={copy.leaderRequiredDescription}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  {copy.backToTours}
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isHydrated && isAuthenticated && leader && !hasTenantId) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title={copy.tenantUnavailableTitle}
              description={copy.tenantUnavailableDescription}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  {copy.signInAgain}
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
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title={copy.apiNotConfiguredTitle}
              description={copy.apiNotConfiguredDescription}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  {copy.backToDashboard}
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (tourLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <LoadingState message={copy.loadingTour} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (tourIsError) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <ErrorState
              title={copy.loadTourErrorTitle}
              message={tourErrorMessage}
              onRetry={() => void refetchTour()}
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!tour) {
    return (
      <RegisteredWorkspacePage
        documentTitle={copy.documentTitle}
        title={copy.title}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title={copy.tourNotFoundTitle}
              description={copy.tourNotFoundDescription}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  {copy.backToTours}
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  const pendingCount = registrations.filter((r) => r.status === "Pending").length;

  const workspaceRefreshing =
    (tourFetching && !tourLoading) || (regFetching && !regLoading) || (waitFetching && !waitLoading);

  const contextValue = {
    tourId,
    tour,
    readOnly,
    registrations,
    waitlist,
    regLoading,
    regIsError,
    refetchRegistrations,
    waitLoading,
    waitIsError,
    refetchWaitlist,
    statusMutation,
    paymentMutation,
    convertMutation,
  };

  return (
    <RegisteredWorkspacePage
      documentTitle={`${copy.documentTitle} · ${tour.title}`}
      title={TOUR_WORKSPACE_COPY.metadata.title}
      description={copy.description(tour.title, tour.acceptedCount, tour.totalCapacity)}
      breadcrumbItems={breadcrumbItems}
      actions={
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
        >
          {copy.tourDetails}
        </Button>
      }
    >
      <TourWorkspaceProvider value={contextValue}>
        <div
          className={cn(styles.workspaceRoot, workspaceRefreshing ? styles.workspaceRootRefreshing : undefined)}
          dir="rtl"
          aria-busy={workspaceRefreshing ? true : undefined}
        >
          {workspaceRefreshing ? (
            <span className={styles.liveRegion} aria-live="polite">
              {copy.updatingLive}
            </span>
          ) : null}
          <div className={styles.workspaceSection}>
            <Card>
              <CardHeader>
                <CardTitle>{copy.overviewTitle}</CardTitle>
              </CardHeader>
              <CardBody>
                {readOnly ? (
                  <p role="status" className={styles.readOnlyBanner}>
                    {workspaceReadOnlyBannerText(tour.lifecycleStatus)}
                  </p>
                ) : null}
                <p>
                  {copy.pendingReview}: <strong>{pendingCount}</strong> · {copy.totalRegistrations}:{" "}
                  <strong>{registrations.length}</strong> · {copy.waitlistEntries}:{" "}
                  <strong>{waitlist.length}</strong>
                </p>
                <p className={styles.helperHint}>{copy.reconciliationHint}</p>
              </CardBody>
            </Card>
          </div>

          <WorkspaceSubnav tourId={tourId} />

          <div className={styles.workspaceTabPanel}>{children}</div>
        </div>
      </TourWorkspaceProvider>
    </RegisteredWorkspacePage>
  );
}
