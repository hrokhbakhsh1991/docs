"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";

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

import { apiLifecycleToFormStatus } from "@/components/tours/tour-lifecycle";

import { lifecycleBadgeVariant } from "./tour-detail-ui";
import { TourTripDetailsPanel } from "./tour-trip-details-panel";

import styles from "./tour-detail-client.module.css";

export type TourDetailClientProps = {
  tourId: string;
};

export function TourDetailClient({ tourId }: TourDetailClientProps) {
  const router = useRouter();
  const tDetail = useTranslations("tours.detail");
  const tList = useTranslations("tours.list");
  const tStatus = useTranslations("tours.status");
  const tTours = useTranslations("tours");
  const tCard = useTranslations("tours.card");
  const { isHydrated, isAuthenticated, user } = useAuth();

  const liveApi = toursUseLiveApi();
  const queryEnabled = Boolean(tourId) && liveApi && isHydrated && isAuthenticated;
  const { tour, isLoading, isFetching, isError, error, refetch } = useTourDetail(tourId, {
    enabled: queryEnabled,
  });

  const breadcrumbItems = useMemo(
    () => [
      { label: tList("breadcrumbHome"), href: "/dashboard" },
      { label: tList("breadcrumbTours"), href: "/tours" },
      { label: tour?.title?.trim() || tDetail("breadcrumbCurrent") },
    ],
    [tDetail, tList, tour?.title],
  );

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

  const toursErrorMessage = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          return tDetail("errorNotFound");
        }
        return err.message.trim() || tDetail("errorLoadGeneric");
      }
      return tDetail("errorLoadConnection");
    },
    [tDetail],
  );

  const chromeDescription =
    tour != null ? formatTourPriceUsd(extractTourPriceUsd(tour.costContext)) : undefined;

  const pageTitleDefault = tDetail("pageTitleDefault");
  const documentTitle = tour?.title ?? pageTitleDefault;

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
        documentTitle={pageTitleDefault}
        title={pageTitleDefault}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <LoadingState message={tDetail("loadingSession")} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={pageTitleDefault}
        title={pageTitleDefault}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tDetail("signInRequired")}
              description={tDetail("signInRequiredDesc")}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  {tDetail("signIn")}
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
        documentTitle={pageTitleDefault}
        title={pageTitleDefault}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tDetail("apiNotConfiguredTitle")}
              description={tDetail("apiNotConfiguredDesc")}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  {tDetail("backToDashboard")}
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
        documentTitle={pageTitleDefault}
        title={pageTitleDefault}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <LoadingState message={tDetail("loadingTour")} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isError) {
    return (
      <RegisteredWorkspacePage
        documentTitle={documentTitle}
        title={pageTitleDefault}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <ErrorState
              title={tDetail("errorLoadTitle")}
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
        title={pageTitleDefault}
        breadcrumbItems={breadcrumbItems}
        actions={null}
      >
        <Card className={styles.stateCard}>
          <CardBody>
            <EmptyState
              title={tDetail("tourNotFoundTitle")}
              description={tDetail("tourNotFoundDesc")}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/tours")}>
                  {tDetail("backToTours")}
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
  const priceUsd = extractTourPriceUsd(tour.costContext);
  const priceLabel = priceUsd > 0 ? formatTourPriceUsd(priceUsd) : tCard("free");
  const descriptionText = (tour.description ?? "").trim();
  const capacityLabel =
    typeof tour.totalCapacity === "number" && Number.isFinite(tour.totalCapacity)
      ? String(tour.totalCapacity)
      : tDetail("emptyValue");

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

  const bookingSummary =
    typeof tour.totalCapacity === "number"
      ? tDetail("bookingSummaryWithCapacity", {
          registered: tour.acceptedCount,
          capacity: tour.totalCapacity,
        })
      : tDetail("bookingSummary", { registered: tour.acceptedCount });

  return (
    <RegisteredWorkspacePage
      documentTitle={documentTitle}
      title={tour.title}
      description={chromeDescription}
      breadcrumbItems={breadcrumbItems}
      actions={null}
    >
      <div
        className={cn(styles.contentRoot, detailRefreshing ? styles.contentRootRefreshing : undefined)}
        aria-busy={detailRefreshing ? true : undefined}
      >
        {detailRefreshing ? (
          <span className={styles.liveRegion} aria-live="polite">
            {tDetail("updatingLive")}
          </span>
        ) : null}
        <div className={styles.stack}>
          <Card>
            <CardHeader>
              <div className={styles.headerRow}>
                <CardTitle>{tDetail("tourInformation")}</CardTitle>
                <Badge variant={lifecycleBadgeVariant(uiStatus)}>{tStatus(uiStatus)}</Badge>
              </div>
            </CardHeader>
            <CardBody className={styles.panelBody}>
              <dl className={styles.meta}>
                <div className={styles.field}>
                  <dt className={styles.term}>{tDetail("fieldTitle")}</dt>
                  <dd className={styles.def}>{tour.title}</dd>
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <dt className={styles.term}>{tDetail("fieldDescription")}</dt>
                  <dd className={styles.def}>
                    {descriptionText ? (
                      <p className={styles.descriptionBody}>{descriptionText}</p>
                    ) : (
                      tDetail("emptyValue")
                    )}
                  </dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.term}>{tDetail("fieldLocation")}</dt>
                  <dd className={styles.def}>{locationLabel}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.term}>{tDetail("fieldCapacity")}</dt>
                  <dd className={styles.def}>{capacityLabel}</dd>
                </div>
                <div className={styles.field}>
                  <dt className={styles.term}>{tDetail("fieldPrice")}</dt>
                  <dd className={styles.def}>{priceLabel}</dd>
                </div>
                {showTourChatLink ? (
                  <div className={styles.field}>
                    <dt className={styles.term}>{tDetail("fieldCommunicationLink")}</dt>
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
              <CardTitle>{tDetail("bookingTitle")}</CardTitle>
            </CardHeader>
            <CardBody className={styles.panelBody}>
              <p className={styles.bookingSummary}>{bookingSummary}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tDetail("actionsTitle")}</CardTitle>
            </CardHeader>
            <CardBody className={styles.panelBody}>
              <div className={styles.actionRow}>
                {isLeaderRole(user?.role) ? (
                  <Button type="button" variant="secondary" onClick={() => router.push(`/tours/${tourId}/edit`)}>
                    {tDetail("editTour")}
                  </Button>
                ) : null}
                {isLeaderRole(user?.role) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.push(`/tours/${tourId}/workspace`)}
                  >
                    {tDetail("registrationsWorkspace")}
                  </Button>
                ) : null}
                {tour.lifecycleStatus === "OPEN" ? (
                  <Button type="button" variant="primary" onClick={() => router.push(`/tours/${tourId}/register`)}>
                    {tDetail("register")}
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
