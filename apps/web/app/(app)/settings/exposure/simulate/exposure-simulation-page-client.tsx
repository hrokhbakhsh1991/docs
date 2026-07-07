"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExposureSimulationConsole } from "@/exposure/ExposureSimulationConsole";
import type { WorkspaceExposureCatalogResponse } from "@/exposure/exposure-catalog-client";
import {
  fetchIntegrationDetail,
} from "@/integrations/integrations-client";
import {
  findProviderSurfaceMeta,
  integrationStatusBadgeKey,
} from "@/integrations/integrations-settings-logic";
import type {
  IntegrationConnectionPublic,
  WorkspaceIntegrationSurfaceMetaResponse,
  WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";

type ExposureSimulationPageClientProps = {
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

export function ExposureSimulationPageClient({
  workspaceId,
  initialList,
  initialMeta,
  initialCatalog,
}: ExposureSimulationPageClientProps) {
  const t = useTranslations("settings.exposure.simulation");
  const tIntegrations = useTranslations("settings.integrations");
  const [list] = useState<WorkspaceIntegrationsListResponse>(initialList ?? EMPTY_INTEGRATIONS_LIST);
  const [meta] = useState<WorkspaceIntegrationSurfaceMetaResponse>(
    initialMeta ?? EMPTY_INTEGRATION_META,
  );
  const [catalog] = useState<WorkspaceExposureCatalogResponse | null>(initialCatalog);
  const [activeId, setActiveId] = useState<string | null>(
    list.items.find((item) => item.enabled)?.id ?? list.items[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<IntegrationConnectionPublic | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const exposureConnections = useMemo(
    () =>
      list.items.filter(
        (item) => item.enabled && item.backingSource === "integration_connection",
      ),
    [list.items],
  );

  const activeItem = detail ?? exposureConnections.find((item) => item.id === activeId) ?? null;
  const activeProviderSurface =
    activeItem === null ? null : findProviderSurfaceMeta(meta, activeItem.provider);

  async function selectConnection(id: string) {
    setActiveId(id);
    setLoadingDetail(true);
    try {
      const nextDetail = await fetchIntegrationDetail(id);
      setDetail(nextDetail);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="operator-settings-exposure-simulation-page">
      <SettingsPageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/settings/exposure">{t("backToExposure")}</Link>
        </Button>
      </div>

      {workspaceId === null ? (
        <p className="text-sm text-muted-foreground">{t("noWorkspace")}</p>
      ) : exposureConnections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("emptyTitle")}</CardTitle>
            <CardDescription>{t("emptyDescription")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t("connectionsTitle")}</CardTitle>
              <CardDescription>{t("connectionsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {exposureConnections.map((connection) => {
                const statusKey = integrationStatusBadgeKey(connection);
                const isActive = connection.id === activeId;
                return (
                  <button
                    key={connection.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                      isActive ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => void selectConnection(connection.id)}
                  >
                    <span className="font-medium capitalize">{connection.provider}</span>
                    <Badge variant={statusKey === "error" ? "destructive" : "outline"}>
                      {tIntegrations(`badges.${statusKey}`)}
                    </Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("consoleTitle")}</CardTitle>
              <CardDescription>{t("consoleDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetail || activeItem === null ? (
                <p className="text-sm text-muted-foreground">{t("loadingConnection")}</p>
              ) : (
                <ExposureSimulationConsole
                  connection={activeItem}
                  providerSurface={activeProviderSurface}
                  exposureCandidateFields={catalog?.fields ?? meta.exposureCandidateFields}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
