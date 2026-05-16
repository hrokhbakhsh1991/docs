"use client";

import { useMemo, useState } from "react";
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

import { RegistrationsTable } from "./RegistrationsTable";
import { WaitlistTable } from "./WaitlistTable";
import {
  isTourReadOnlyForWorkspace,
  workspaceReadOnlyBannerText,
} from "./tour-workspace-ui";

import stateStyles from "./tour-workspace-state.module.css";
import styles from "./tour-workspace.module.css";

export type TourWorkspaceClientProps = {
  tourId: string;
};

export function TourWorkspaceClient({ tourId }: TourWorkspaceClientProps) {
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

  const [registrationListFilter, setRegistrationListFilter] = useState<"all" | "pending">("all");

  const tourErrorMessage =
    tourError instanceof ApiError
      ? tourError.status === 404
        ? "No tour was found with this id."
        : tourError.message.trim() || "Could not load tour details. Please try again."
      : "Could not load tour details. Please try again.";

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Tours", href: "/tours" },
      { label: tour?.title ?? "Tour" },
      { label: "Registrations workspace" },
    ],
    [tour?.title],
  );

  const readOnly = tour != null && isTourReadOnlyForWorkspace(tour.lifecycleStatus);

  if (toursUseLiveApi() && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
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
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title="Sign in required"
              description="Your session is missing or expired. Sign in to open the leader workspace."
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
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title="Leader access required"
              description="Only users with the leader role can open the registrations workspace."
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

  if (isHydrated && isAuthenticated && leader && !hasTenantId) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title="Tenant not available"
              description="Your session is missing tenant context. Sign in again to continue."
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in again
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
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <EmptyState
              title="Workspace API not configured"
              description="Use your workspace host and ensure the API is running to load this workspace."
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

  if (tourLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <LoadingState message="Loading tour…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (tourIsError) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
          <CardBody>
            <ErrorState
              title="Could not load tour"
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
        documentTitle="Workspace"
        title="Leader workspace"
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={stateStyles.stateCard}>
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

  const pendingCount = registrations.filter((r) => r.status === "Pending").length;

  const workspaceRefreshing =
    (tourFetching && !tourLoading) || (regFetching && !regLoading) || (waitFetching && !waitLoading);

  return (
    <RegisteredWorkspacePage
      documentTitle={`Workspace · ${tour.title}`}
      title="Registrations workspace"
      description={`${tour.title} · ${tour.acceptedCount}/${tour.totalCapacity} accepted`}
      breadcrumbItems={breadcrumbItems}
      actions={
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
        >
          Tour details
        </Button>
      }
    >
      <div
        className={cn(styles.workspaceRoot, workspaceRefreshing ? styles.workspaceRootRefreshing : undefined)}
        aria-busy={workspaceRefreshing ? true : undefined}
      >
        {workspaceRefreshing ? (
          <span className={styles.liveRegion} aria-live="polite">
            Updating workspace data
          </span>
        ) : null}
        <div className={styles.workspaceSection}>
          <Card>
            <CardHeader>
              <CardTitle>Overview (J‑L‑02)</CardTitle>
            </CardHeader>
            <CardBody>
              {readOnly ? (
                <p role="status" className={styles.readOnlyBanner}>
                  {workspaceReadOnlyBannerText(tour.lifecycleStatus)}
                </p>
              ) : null}
              <p>
                Pending review: <strong>{pendingCount}</strong> · Total registrations in list:{" "}
                <strong>{registrations.length}</strong> · Waitlist entries: <strong>{waitlist.length}</strong>
              </p>
              <p className={styles.helperHint}>
                Cross-tour reconciliation: use Dashboard → Review queue → Export CSV (built from live list
                endpoints).
              </p>
            </CardBody>
          </Card>
        </div>

        <div className={styles.workspaceSection}>
          <RegistrationsTable
            registrations={registrations}
            filter={registrationListFilter}
            onFilterChange={setRegistrationListFilter}
            readOnly={readOnly}
            isLoading={regLoading}
            isError={regIsError}
            onRetry={() => void refetchRegistrations()}
            statusMutation={statusMutation}
            paymentMutation={paymentMutation}
          />
        </div>

        <div className={styles.workspaceSection}>
          <WaitlistTable
            waitlist={waitlist}
            readOnly={readOnly}
            isLoading={waitLoading}
            isError={waitIsError}
            onRetry={() => void refetchWaitlist()}
            convertMutation={convertMutation}
          />
        </div>
      </div>
    </RegisteredWorkspacePage>
  );
}
