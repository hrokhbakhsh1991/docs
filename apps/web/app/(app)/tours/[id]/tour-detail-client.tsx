"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@tour/ui";

import {
  isTourDetailGearAggregationIncomplete,
  shouldShowTourDetailEquipmentCard,
} from "@/lib/tours/tour-detail-visibility";
import { canViewTourDetailChatLink } from "@/lib/tours/tour-detail-access-ui";
import { formatTourLocationV2 } from "@/app/(app)/tours/tour-location-formatters";
import { extractTourPriceUsd, formatTourPriceUsd } from "@/components/tours/formatters";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { ApiError } from "@/lib/api-client";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useTourDetail } from "@/features/tours/hooks/useTourDetail";

import { apiLifecycleToFormStatus, lifecycleDisplayLabel } from "@/components/tours/tour-lifecycle";

import { lifecycleBadgeVariant } from "./tour-detail-ui";
import { TourTripDetailsPanel } from "./tour-trip-details-panel";

import styles from "./tour-detail-client.module.css";

export type TourDetailClientProps = {
  tourId: string;
};

const breadcrumbTrail = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tours", href: "/tours" },
  { label: "Tour details" },
] as const;

export function TourDetailClient({ tourId }: TourDetailClientProps) {
  const router = useRouter();
  const tTours = useTranslations("tours");
  const { isHydrated, isAuthenticated, user } = useAuth();

  const liveApi = toursUseLiveApi();
  const queryEnabled = Boolean(tourId) && liveApi && isHydrated && isAuthenticated;
  const { tour, isLoading, isFetching, isError, error, refetch } = useTourDetail(tourId, {
    enabled: queryEnabled,
  });

  const tripOverview = tour?.details?.tripDetails?.overview as
    | {
        tourThemeIds?: unknown;
        tourThemeLabels?: Record<string, string>;
        resolvedThemes?: { id: string; name: string }[];
      }
    | undefined;

  const themeIdList = useMemo(() => {
    const fromResolved = tripOverview?.resolvedThemes?.map((row) => row.id) ?? [];
    if (fromResolved.length > 0) {
      return fromResolved;
    }
    const raw = tripOverview?.tourThemeIds;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }, [tripOverview]);

  const themeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of tripOverview?.resolvedThemes ?? []) {
      m.set(row.id, row.name);
    }
    return m;
  }, [tripOverview?.resolvedThemes]);

  const participation = tour?.details?.tripDetails?.participation as
    | {
        gearRequiredIds?: string[];
        gearOptionalIds?: string[];
        resolvedGear?: { required: { id: string; name: string }[]; optional: { id: string; name: string }[] };
      }
    | undefined;

  const gearLists = participation?.resolvedGear ?? { required: [], optional: [] };

  const gearRequiredIds = participation?.gearRequiredIds;
  const gearOptionalIds = participation?.gearOptionalIds;

  const showEquipmentCard = shouldShowTourDetailEquipmentCard({
    gearLists,
    gearRequiredIds,
    gearOptionalIds,
  });

  const gearAggregationIncomplete = isTourDetailGearAggregationIncomplete({
    participationPresent: Boolean(participation),
    gearLists,
    gearRequiredIds,
    gearOptionalIds,
  });

  const errorMessage =
    error instanceof ApiError
      ? error.status === 404
        ? "No tour was found with this id."
        : error.message.trim() || "Could not load tour details. Please try again."
      : "Could not load tour details. Please try again.";

  const chromeDescription =
    tour != null ? formatTourPriceUsd(extractTourPriceUsd(tour.costContext)) : undefined;

  const documentTitle = tour?.title ?? "Tour details";

  const tourSubtitle = useMemo(() => {
    if (!tour) return undefined;
    return lifecycleDisplayLabel(apiLifecycleToFormStatus(tour.lifecycleStatus));
  }, [tour]);

  const resolveThemeLabel = (id: string): string => {
    const fromCatalog = themeNameById.get(id);
    if (fromCatalog) {
      return fromCatalog;
    }
    const o = tour?.details?.tripDetails?.overview as { tourThemeLabels?: Record<string, string> } | undefined;
    const snapshot = o?.tourThemeLabels?.[id]?.trim();
    if (snapshot) {
      return snapshot;
    }
    return tTours("detail_themeUnknown", { id: `${id.slice(0, 8)}…` });
  };

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

  if (!liveApi && isHydrated) {
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
              title="Workspace API not configured"
              description="Open this app on your workspace host (e.g. ws1-rbac.localhost) to load tour details."
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

  const uiStatus = apiLifecycleToFormStatus(tour.lifecycleStatus);
  const locationLabel = formatTourLocationV2(tour);
  const priceLabel = formatTourPriceUsd(extractTourPriceUsd(tour.costContext));
  const descriptionText = (tour.description ?? "").trim();
  const capacityLabel =
    typeof tour.totalCapacity === "number" && Number.isFinite(tour.totalCapacity)
      ? String(tour.totalCapacity)
      : "—";

  const accessLevel = tour.accessLevel ?? "GUEST";
  const viewHints = tour.viewHints ?? { gpsUnlocked: false, gpsUnlockAt: null };

  /** FR-61 (MVP): chat link only for owner/admin tiers (BFF also strips for others). */
  const leaderVisibleChatLink =
    isLeaderRole(user?.role) &&
    canViewTourDetailChatLink(accessLevel) &&
    typeof tour.communicationLink === "string"
      ? tour.communicationLink.trim()
      : "";
  const showTourChatLink = leaderVisibleChatLink.length > 0;

  const detailRefreshing = Boolean(tour && !isLoading && isFetching);

  return (
    <RegisteredWorkspacePage
      documentTitle={documentTitle}
      title={tour.title}
      description={chromeDescription}
      breadcrumbItems={[...breadcrumbTrail]}
      actions={null}
    >
      <div
        className={cn(styles.contentRoot, detailRefreshing ? styles.contentRootRefreshing : undefined)}
        aria-busy={detailRefreshing ? true : undefined}
      >
        {detailRefreshing ? (
          <span className={styles.liveRegion} aria-live="polite">
            Updating tour details
          </span>
        ) : null}
        <div className={styles.stack}>
        <Card>
          <CardHeader>
            <div className={styles.headerRow}>
              <CardTitle>Tour Information</CardTitle>
              <Badge variant={lifecycleBadgeVariant(uiStatus)}>{lifecycleDisplayLabel(uiStatus)}</Badge>
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
              {showTourChatLink ? (
                <div className={styles.field}>
                  <dt className={styles.term}>Communication link</dt>
                  <dd className={styles.def}>
                    <a href={leaderVisibleChatLink} target="_blank" rel="noopener noreferrer">
                      {leaderVisibleChatLink}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardBody>
        </Card>

        <TourTripDetailsPanel
          tour={tour}
          accessLevel={accessLevel}
          viewHints={viewHints}
          showRegister={accessLevel === "GUEST" && tour.lifecycleStatus === "OPEN"}
          onRegister={() => router.push(`/tours/${tourId}/register`)}
        />

        {themeIdList.length > 0 ? (
          <Card data-testid="tour-detail-themes">
            <CardHeader>
              <CardTitle>{tTours("detail_tourThemes")}</CardTitle>
            </CardHeader>
            <CardBody className={styles.panelBody}>
              <ul className={styles.equipmentList}>
                {themeIdList.map((id) => (
                  <li key={id}>{resolveThemeLabel(id)}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {showEquipmentCard ? (
          <Card data-testid="tour-detail-equipment">
            <CardHeader>
              <CardTitle>{tTours("detail_equipment")}</CardTitle>
            </CardHeader>
            <CardBody className={styles.panelBody}>
              {gearAggregationIncomplete ? (
                <p className={styles.equipmentMuted}>{tTours("detail_equipmentLoadError")}</p>
              ) : null}
              {gearLists.required.length > 0 ? (
                <>
                  <p className={styles.equipmentSubheading}>{tTours("detail_requiredEquipment")}</p>
                  <ul className={styles.equipmentList}>
                    {gearLists.required.map((gear) => (
                      <li key={`req-${gear.id}`}>{gear.name}</li>
                    ))}
                  </ul>
                </>
              ) : (gearRequiredIds?.length ?? 0) > 0 ? (
                <>
                  <p className={styles.equipmentSubheading}>{tTours("detail_requiredEquipment")}</p>
                  <ul className={styles.equipmentList}>
                    {(gearRequiredIds ?? []).map((id) => (
                      <li key={`req-id-${id}`}>{id}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {gearLists.optional.length > 0 ? (
                <>
                  <p className={styles.equipmentSubheading}>{tTours("detail_optionalEquipment")}</p>
                  <ul className={styles.equipmentList}>
                    {gearLists.optional.map((gear) => (
                      <li key={`opt-${gear.id}`}>{gear.name}</li>
                    ))}
                  </ul>
                </>
              ) : (gearOptionalIds?.length ?? 0) > 0 ? (
                <>
                  <p className={styles.equipmentSubheading}>{tTours("detail_optionalEquipment")}</p>
                  <ul className={styles.equipmentList}>
                    {(gearOptionalIds ?? []).map((id) => (
                      <li key={`opt-id-${id}`}>{id}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

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
              {tour.lifecycleStatus === "OPEN" ? (
                <Button type="button" variant="primary" onClick={() => router.push(`/tours/${tourId}/register`)}>
                  Register
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
        </div>
      </div>
    </RegisteredWorkspacePage>
  );
}
