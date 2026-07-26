"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { operatorCapabilitySupportsFieldExposureSurfaces } from "@app-tour/workspace-sdk";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { SETTINGS_HUB_TEST_IDS } from "@/features/settings/settings-module-types";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  fetchWorkspaceExposureCatalog,
  type WorkspaceExposureCatalogResponse,
} from "@/exposure/exposure-catalog-client";
import {
  fetchIntegrationDetail,
  fetchWorkspaceIntegrationMeta,
  fetchWorkspaceIntegrations,
} from "@/integrations/integrations-client";
import {
  findProviderSurfaceMeta,
  integrationStatusBadgeKey,
  isLegacyBackedIntegration,
} from "@/integrations/integrations-settings-logic";
import type {
  IntegrationConnectionPublic,
  WorkspaceIntegrationSurfaceMetaResponse,
  WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";
import { IntegrationConnectionLoadWarningsBanner } from "@/integrations/IntegrationConnectionLoadWarningsBanner";
import { IntegrationEventDeliveryPolicyPanel } from "../integrations/integration-event-delivery-policy-panel";
import { ensureSettingsExposureSurfacesUiSurface } from "@/features/settings/settings-exposure-surfaces-ui-registry";
import type { SettingsExposureSurfacesUiSurface } from "@/features/settings/settings-exposure-surfaces-ui-types";
import { webSettingsExposureSurfacesChrome } from "@/exposure/web-settings-exposure-surfaces-chrome";
import { webSettingsExposureSurfacesIo } from "@/exposure/web-settings-exposure-surfaces-io";
import { webSettingsExposureSurfacesSelection } from "@/exposure/web-settings-exposure-surfaces-selection";

type ExposureSettingsClientProps = {
  readonly session: OperatorSessionContext;
  readonly workspaceId: string | null;
  readonly initialList: WorkspaceIntegrationsListResponse | null;
  readonly initialMeta: WorkspaceIntegrationSurfaceMetaResponse | null;
  readonly initialCatalog: WorkspaceExposureCatalogResponse | null;
};

const EMPTY_INTEGRATIONS_LIST: WorkspaceIntegrationsListResponse = {
  items: [],
  summary: {
    integrationConnectionCount: 0,
    legacyConnectionCount: 0,
    activeDeliverySource: null,
  },
};
const EMPTY_INTEGRATION_META: WorkspaceIntegrationSurfaceMetaResponse = {
  workspaceType: null,
  providers: [],
  exposureCandidateFields: [],
};

export function ExposureSettingsClient({
  session,
  workspaceId,
  initialList,
  initialMeta,
  initialCatalog,
}: ExposureSettingsClientProps) {
  const t = useTranslations("settings.exposure");
  const tIntegrations = useTranslations("settings.integrations");
  const tIntegrationErrors = useTranslations("settings.integrations.errors");
  const canManageExposure = isAdminOrOwnerRole(session.role);
  const [exposureSurfacesUi, setExposureSurfacesUi] =
    useState<SettingsExposureSurfacesUiSurface | null>(null);
  useEffect(() => {
    let cancelled = false;
    void ensureSettingsExposureSurfacesUiSurface(session.pluginId).then((surface) => {
      if (!cancelled) {
        setExposureSurfacesUi(surface);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);
  const WorkspaceSurfacesPanel = exposureSurfacesUi?.WorkspaceSurfacesPanel;
  const [list, setList] = useState<WorkspaceIntegrationsListResponse>(
    initialList ?? EMPTY_INTEGRATIONS_LIST,
  );
  const [meta, setMeta] = useState<WorkspaceIntegrationSurfaceMetaResponse>(
    initialMeta ?? EMPTY_INTEGRATION_META,
  );
  const [catalog, setCatalog] = useState<WorkspaceExposureCatalogResponse | null>(initialCatalog);
  const [catalogError, setCatalogError] = useState<string | null>(
    workspaceId !== null && initialCatalog === null ? "pending" : null,
  );
  const [catalogRetrying, setCatalogRetrying] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    list.items.find((item) => item.enabled)?.id ?? list.items[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<IntegrationConnectionPublic | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetryNonce, setDetailRetryNonce] = useState(0);

  const exposureConnections = useMemo(
    () =>
      list.items.filter(
        (item) =>
          item.enabled &&
          (item.backingSource === "integration_connection" ||
            item.backingSource === "legacy_workspace_telegram_bot"),
      ),
    [list.items],
  );

  const activeItem = detail ?? exposureConnections.find((item) => item.id === activeId) ?? null;
  const activeProviderSurface =
    activeItem === null ? null : findProviderSurfaceMeta(meta, activeItem.provider);

  const catalogReady = catalog !== null && catalog.fields.length > 0;

  async function refreshCatalog(): Promise<void> {
    if (workspaceId === null) {
      return;
    }
    setCatalogRetrying(true);
    try {
      const nextCatalog = await fetchWorkspaceExposureCatalog(workspaceId);
      setCatalog(nextCatalog);
      setCatalogError(null);
    } catch {
      setCatalogError(t("catalogLoadFailed"));
    } finally {
      setCatalogRetrying(false);
    }
  }

  useEffect(() => {
    if (catalogError === "pending") {
      setCatalogError(t("catalogLoadFailed"));
    }
  }, [catalogError, t]);

  async function refreshList(preferredId?: string) {
    if (workspaceId === null) {
      return;
    }
    const [nextList, nextMeta, nextCatalogResult] = await Promise.allSettled([
      fetchWorkspaceIntegrations(workspaceId),
      fetchWorkspaceIntegrationMeta(workspaceId),
      fetchWorkspaceExposureCatalog(workspaceId),
    ]);
    if (nextList.status === "fulfilled") {
      const nextListValue = nextList.value;
      setList(nextListValue);
      const nextActive =
        preferredId ??
        activeId ??
        nextListValue.items.find((item) => item.enabled)?.id ??
        nextListValue.items[0]?.id ??
        null;
      setActiveId(nextActive);
    }
    if (nextMeta.status === "fulfilled") {
      setMeta(nextMeta.value);
    }
    if (nextCatalogResult.status === "fulfilled") {
      setCatalog(nextCatalogResult.value);
      setCatalogError(null);
    } else {
      setCatalogError(t("catalogLoadFailed"));
    }
  }

  async function loadConnectionDetail(id: string): Promise<void> {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const nextDetail = await fetchIntegrationDetail(id);
      setDetail(nextDetail);
    } catch (fetchError: unknown) {
      setDetail(null);
      setDetailError(
        fetchError instanceof Error ? fetchError.message : "INTEGRATION_DETAIL_FAILED",
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function selectConnection(id: string) {
    setActiveId(id);
    await loadConnectionDetail(id);
  }

  useEffect(() => {
    if (activeId === null || exposureConnections.length === 0) {
      return;
    }
    if (!exposureConnections.some((connection) => connection.id === activeId)) {
      return;
    }
    if (detail?.id === activeId) {
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    void fetchIntegrationDetail(activeId)
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(
            fetchError instanceof Error ? fetchError.message : "INTEGRATION_DETAIL_FAILED",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, detail?.id, detailRetryNonce, exposureConnections]);

  return (
    <div
      className="mx-auto max-w-5xl space-y-8 pb-8"
      data-testid={SETTINGS_HUB_TEST_IDS.exposurePage}
    >
      <SettingsPageHeader title={t("title")} description={t("description")} />

      {workspaceId === null ? (
        <p className="text-sm text-muted-foreground">{t("noWorkspace")}</p>
      ) : (
        <>
          {catalogError !== null ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
              role="alert"
              data-testid="exposure-catalog-error"
            >
              <p className="text-destructive">{catalogError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={catalogRetrying}
                onClick={() => void refreshCatalog()}
              >
                {catalogRetrying ? t("catalogRetrying") : t("catalogRetry")}
              </Button>
            </div>
          ) : null}

          {detailError !== null ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
              role="alert"
              data-testid="exposure-detail-error"
            >
              <p className="text-destructive">
                {resolveCodedErrorMessage(tIntegrationErrors, detailError) || t("detailLoadFailed")}
              </p>
              {activeId !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={loadingDetail}
                  onClick={() => setDetailRetryNonce((value) => value + 1)}
                >
                  {loadingDetail ? t("detailRetrying") : t("detailRetry")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {detailError === null && detail !== null ? (
            <IntegrationConnectionLoadWarningsBanner
              loadWarnings={detail.loadWarnings}
              tourPublishedPolicyDriftLabel={t("tourPublishedPolicyDriftBanner")}
              detailDegradedLabel={t("detailDegradedBanner")}
              testId="exposure-connection-load-warnings"
            />
          ) : null}

          {!catalogError && catalog?.source === "registry_deliverable_migration_seed" ? (
            <p
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"
              data-testid="exposure-catalog-seed-banner"
            >
              {t("catalogSeedBanner")}
            </p>
          ) : null}

          {!catalogError && catalog?.source === "published_wizard_template" ? (
            <p
              className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground"
              data-testid="exposure-catalog-published-banner"
            >
              {t("catalogPublishedBanner")}
            </p>
          ) : null}

          {exposureConnections.length === 0 ? (
            <Card data-operator-surface="card" className="shadow-sm">
              <CardHeader>
                <CardTitle>{t("emptyTitle")}</CardTitle>
                <CardDescription>{t("emptyDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/settings/integrations"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("goToIntegrations")}
                </Link>
              </CardContent>
            </Card>
          ) : exposureConnections.length === 1 ? (
            <section className="space-y-4" aria-labelledby="exposure-telegram-section-title">
              <Card
                data-operator-surface="card"
                className="shadow-sm"
                data-testid={SETTINGS_HUB_TEST_IDS.exposureTelegramPanel}
              >
                <CardHeader className="border-b border-border/60 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle id="exposure-telegram-section-title">
                        {t("telegramSectionTitle")}
                      </CardTitle>
                      <CardDescription>{t("telegramSectionDescription")}</CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href="/settings/integrations">
                        {t("manageTelegramConnection")}
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {loadingDetail || activeItem === null ? (
                    <OperatorSkeleton size="panel-lg" />
                  ) : detailError !== null ? (
                    <p className="text-sm text-muted-foreground">{t("detailLoadFailed")}</p>
                  ) : catalogError !== null || !catalogReady ? (
                    <p className="text-sm text-muted-foreground">{t("catalogLoadFailed")}</p>
                  ) : (
                    <IntegrationEventDeliveryPolicyPanel
                      connection={activeItem}
                      providerSurface={activeProviderSurface}
                      exposureCandidateFields={catalog?.fields ?? []}
                      pluginId={session.pluginId}
                      canEdit={
                        canManageExposure &&
                        activeItem.actionsAllowed.patch &&
                        !isLegacyBackedIntegration(activeItem)
                      }
                      onUpdated={(updated) => {
                        setDetail(updated);
                        void refreshList(updated.id);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
              <Card data-operator-surface="card" className="h-fit shadow-sm lg:sticky lg:top-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("connectionsTitle")}</CardTitle>
                  <CardDescription>{t("connectionsDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {exposureConnections.map((connection) => {
                    const label = connection.provider;
                    const statusKey = integrationStatusBadgeKey(connection);
                    const isActive = connection.id === activeId;
                    return (
                      <button
                        key={connection.id}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition ${
                          isActive
                            ? "border-primary bg-primary/5 font-medium text-foreground"
                            : "border-transparent hover:border-border hover:bg-muted/40"
                        }`}
                        onClick={() => void selectConnection(connection.id)}
                      >
                        <span className="capitalize">{label}</span>
                        <span
                          className={`text-xs ${
                            statusKey === "error" ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {tIntegrations(`badges.${statusKey}`)}
                        </span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card
                data-operator-surface="card"
                className="shadow-sm"
                data-testid={SETTINGS_HUB_TEST_IDS.exposureTelegramPanel}
              >
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle className="text-base">{t("telegramSectionTitle")}</CardTitle>
                  <CardDescription>{t("telegramSectionDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {loadingDetail || activeItem === null ? (
                    <OperatorSkeleton size="panel-lg" />
                  ) : detailError !== null ? (
                    <p className="text-sm text-muted-foreground">{t("detailLoadFailed")}</p>
                  ) : catalogError !== null || !catalogReady ? (
                    <p className="text-sm text-muted-foreground">{t("catalogLoadFailed")}</p>
                  ) : (
                    <IntegrationEventDeliveryPolicyPanel
                      connection={activeItem}
                      providerSurface={activeProviderSurface}
                      exposureCandidateFields={catalog?.fields ?? []}
                      pluginId={session.pluginId}
                      canEdit={
                        canManageExposure &&
                        activeItem.actionsAllowed.patch &&
                        !isLegacyBackedIntegration(activeItem)
                      }
                      onUpdated={(updated) => {
                        setDetail(updated);
                        void refreshList(updated.id);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {!catalogError &&
          operatorCapabilitySupportsFieldExposureSurfaces(session.pluginId) &&
          WorkspaceSurfacesPanel != null ? (
            <>
              <Separator />
              <WorkspaceSurfacesPanel
                workspaceId={workspaceId}
                exposureCandidateFields={catalog?.fields ?? []}
                canEdit={canManageExposure}
                io={webSettingsExposureSurfacesIo}
                chrome={webSettingsExposureSurfacesChrome}
                selection={webSettingsExposureSurfacesSelection}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
