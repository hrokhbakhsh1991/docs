"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  type BadgeVariant,
} from "@tour/ui";

import {
  extractTourPriceUsd,
  formatTourDateLabel,
  formatTourDateRange,
  formatTourLocation,
  formatTourPriceUsd,
} from "@/components/tours/formatters";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";

import { tourKeys } from "@/lib/query-keys";

import { getTourById, toursUseLiveApi } from "../../../../lib/services/tours.service";

import { apiLifecycleToUi } from "../tour-ui-mappers";

import styles from "./tour-detail-client.module.css";

export type TourDetailClientProps = {
  tourId: string;
};

const breadcrumbTrail = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tours", href: "/tours" },
  { label: "Tour details" },
] as const;

function lifecycleBadgeVariant(status: ReturnType<typeof apiLifecycleToUi>): BadgeVariant {
  switch (status) {
    case "Published":
      return "success";
    case "Archived":
      return "info";
    default:
      return "neutral";
  }
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  return formatTourDateLabel(iso);
}

export function TourDetailClient({ tourId }: TourDetailClientProps) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi();
  const queryEnabled = Boolean(tourId) && liveApi && isHydrated && isAuthenticated;
  const {
    data: tour,
    isPending: isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: tourKeys.detail(tourId),
    queryFn: () => getTourById(tourId),
    enabled: queryEnabled,
  });

  const errorMessage =
    error instanceof ApiError
      ? error.status === 404
        ? "No tour was found with this id."
        : error.message
      : "Could not load tour details. Please try again.";

  const chromeDescription =
    tour != null
      ? `${formatTourDateRange(tour)} · ${formatTourPriceUsd(extractTourPriceUsd(tour.costContext))}`
      : undefined;

  const documentTitle = tour?.title ?? "Tour details";

  const tourSubtitle = useMemo(() => {
    if (!tour) return undefined;
    const ui = apiLifecycleToUi(tour.lifecycleStatus);
    const parts = [ui, formatTourDateRange(tour)].filter((p) => p && p !== "—");
    return parts.join(" · ");
  }, [tour]);

  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Tour details"
        title="Tour details"
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

  if (isLoading) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Tour details"
        title="Tour details"
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

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Tour details"
        title="Tour details"
        breadcrumbItems={[...breadcrumbTrail]}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title="Sign in required"
              description="Your session is missing or expired. Sign in to load tour details."
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

  if (isError) {
    return (
      <RegisteredWorkspacePage
        documentTitle={documentTitle}
        title="Tour details"
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
        documentTitle={documentTitle}
        title="Tour details"
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

  const uiStatus = apiLifecycleToUi(tour.lifecycleStatus);
  const locationLabel = formatTourLocation(tour);
  const priceLabel = formatTourPriceUsd(extractTourPriceUsd(tour.costContext));
  const descriptionText = (tour.description ?? "").trim();
  const capacityLabel =
    typeof tour.totalCapacity === "number" && Number.isFinite(tour.totalCapacity)
      ? String(tour.totalCapacity)
      : "—";

  return (
    <RegisteredWorkspacePage
      documentTitle={documentTitle}
      title={tour.title}
      description={chromeDescription}
      breadcrumbItems={[...breadcrumbTrail]}
      actions={null}
    >
      <div className={styles.stack}>
        <Card>
          <CardHeader>
            <div className={styles.headerRow}>
              <CardTitle>Tour Information</CardTitle>
              <Badge variant={lifecycleBadgeVariant(uiStatus)}>{uiStatus}</Badge>
            </div>
            {tourSubtitle ? <p className={styles.sectionLead}>{tourSubtitle}</p> : null}
          </CardHeader>
          <CardBody className={styles.panelBody}>
            <dl className={styles.meta}>
              <div className={styles.field}>
                <dt className={styles.term}>Title</dt>
                <dd className={styles.def}>{tour.title}</dd>
              </div>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <dt className={styles.term}>Description</dt>
                <dd className={styles.def}>
                  {descriptionText ? <p className={styles.descriptionBody}>{descriptionText}</p> : "—"}
                </dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Location</dt>
                <dd className={styles.def}>{locationLabel}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Capacity</dt>
                <dd className={styles.def}>{capacityLabel}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Price</dt>
                <dd className={styles.def}>{priceLabel}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Start date</dt>
                <dd className={styles.def}>{formatDisplayDate(tour.startDate)}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>End date</dt>
                <dd className={styles.def}>{formatDisplayDate(tour.endDate)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
          </CardHeader>
          <CardBody className={styles.panelBody}>
            <p className={styles.bookingSummary}>
              <strong>{tour.acceptedCount}</strong> registered
              {typeof tour.totalCapacity === "number" ? (
                <>
                  {" "}
                  · <strong>{tour.totalCapacity}</strong> total capacity
                </>
              ) : null}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardBody className={styles.panelBody}>
            <div className={styles.actionRow}>
              {isLeaderRole(user?.role) ? (
                <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}/edit`)}>
                  Edit Tour
                </Button>
              ) : null}
              {isLeaderRole(user?.role) ? (
                <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}/workspace`)}>
                  Registrations workspace
                </Button>
              ) : null}
              <Button type="button" variant="primary" onClick={() => router.push(`/tours/${tourId}/register`)}>
                Register
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </RegisteredWorkspacePage>
  );
}
