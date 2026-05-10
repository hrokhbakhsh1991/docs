"use client";

import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  CardBody,
  cn,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@tour/ui";

import { TourForm } from "@/components/tours/TourForm";
import { useTourDetail } from "@/features/tours/hooks/useTourDetail";
import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useUpdateTour } from "@/features/tours/hooks/useUpdateTour";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { ApiError } from "@/lib/api-client";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";

import { updateTourDtoFromTourFormValues } from "../../tour-ui-mappers";

import styles from "./tour-edit-client.module.css";

export function TourEditClient({ tourId }: { tourId: string }) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi();
  const leader = isLeaderRole(user?.role);

  const queryEnabled = Boolean(tourId) && liveApi && isHydrated && isAuthenticated && leader;
  const { tour, isLoading, isFetching, isError, error, refetch } = useTourDetail(tourId, {
    enabled: queryEnabled,
  });
  const updateMutation = useUpdateTour(tourId);
  const tourThemesQuery = useSettingsTourThemes();

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

  const shellTitle = "Edit tour";
  const documentTitle = tour?.title ? `Edit ${tour.title}` : "Edit tour";

  const canEditLifecycle =
    tour != null && (tour.lifecycleStatus === "DRAFT" || tour.lifecycleStatus === "OPEN");

  if (liveApi && !isHydrated) {
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
              description="Set NEXT_PUBLIC_API_URL in your environment to load and edit tours."
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
      description={`Editing ${tour.title} — changes save via PATCH /api/v2/tours/${tourId}.`}
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
        <TourForm
          mode="edit"
          tour={tour}
          onCancel={() => router.push(`/tours/${encodeURIComponent(tourId)}`)}
          onSubmit={async (values) => {
            const updated = await updateMutation.mutateAsync({
              dto: updateTourDtoFromTourFormValues(values, tour, tourThemesQuery.data ?? []),
              mergeCostFrom: tour.costContext ?? null,
            });
            if (!updated) {
              throw new Error("Tour not found");
            }
            router.push(`/tours/${encodeURIComponent(tourId)}`);
          }}
        />
      </div>
    </RegisteredWorkspacePage>
  );
}
