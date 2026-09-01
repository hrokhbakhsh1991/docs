"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { OPERATOR_WARNING_CALLOUT_PANEL_CLASS } from "@/admin/patterns/operator-semantic-surfaces";
import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExposureEnginePreviewPanel } from "@/exposure/ExposureEnginePreviewPanel";
import {
  fetchWorkspaceExposureControlPlane,
  type WorkspaceExposureControlPlaneResponse,
} from "@/exposure/exposure-control-plane-client";

type ExposureControlPlaneClientProps = {
  readonly session: OperatorSessionContext;
  readonly workspaceId: string | null;
  readonly initialControlPlane: WorkspaceExposureControlPlaneResponse | null;
};

export function ExposureControlPlaneClient({
  workspaceId,
  initialControlPlane,
}: ExposureControlPlaneClientProps) {
  const t = useTranslations("settings.exposure.controlPlane");
  const [controlPlane, setControlPlane] = useState(initialControlPlane);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    initialControlPlane?.connections[0]?.connectionId ?? null,
  );

  const activeConnection = useMemo(
    () => controlPlane?.connections.find((entry) => entry.connectionId === activeConnectionId) ?? null,
    [activeConnectionId, controlPlane?.connections],
  );

  async function refresh(): Promise<void> {
    if (workspaceId === null) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchWorkspaceExposureControlPlane(workspaceId);
      setControlPlane(next);
      if (next.connections.length > 0) {
        setActiveConnectionId((current) =>
          current !== null && next.connections.some((entry) => entry.connectionId === current)
            ? current
            : next.connections[0]!.connectionId,
        );
      }
    } catch (refreshError: unknown) {
      setError(refreshError instanceof Error ? refreshError.message : "EXPOSURE_CONTROL_PLANE_FAILED");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="operator-settings-exposure-control-plane-page">
      <SettingsPageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
          {loading ? t("refreshing") : t("refresh")}
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/settings/exposure">{t("backToExposure")}</Link>
        </Button>
      </div>

      {workspaceId === null ? (
        <p className="text-sm text-muted-foreground">{t("noWorkspace")}</p>
      ) : controlPlane === null ? (
        <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("runtimeTitle")}</CardTitle>
              <CardDescription>{t("runtimeDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("runtimeMode")}</p>
                <Badge variant="outline">{controlPlane.runtime.fieldExposureRuntimeMode}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("activeSelector")}</p>
                <Badge variant="outline">{controlPlane.runtime.activeDeliverySelector}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("parityInstrumentation")}</p>
                <Badge variant="outline">{controlPlane.runtime.parityInstrumentation}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("forwardShadow")}</p>
                <Badge variant={controlPlane.runtime.forwardEngineShadowEnabled ? "default" : "outline"}>
                  {controlPlane.runtime.forwardEngineShadowEnabled ? t("enabled") : t("disabled")}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}

          {controlPlane.connections.length === 0 ? (
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
                  {controlPlane.connections.map((connection) => {
                    const isActive = connection.connectionId === activeConnectionId;
                    return (
                      <button
                        key={connection.connectionId}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                          isActive ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        onClick={() => setActiveConnectionId(connection.connectionId)}
                      >
                        <span className="font-medium capitalize">{connection.provider}</span>
                        <Badge variant="outline">{connection.backingSource}</Badge>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="space-y-6">
                {activeConnection === null ? (
                  <p className="text-sm text-muted-foreground">{t("selectConnection")}</p>
                ) : (
                  activeConnection.contexts.map((eventContext) => (
                    <Card key={eventContext.eventType}>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="font-mono text-sm">{eventContext.eventType}</CardTitle>
                          <Badge variant={eventContext.eventPolicyEnabled ? "default" : "outline"}>
                            {eventContext.eventPolicyEnabled ? t("eventEnabled") : t("eventDisabled")}
                          </Badge>
                        </div>
                        <CardDescription>{t("eventDescription")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <dl className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("surface")}</dt>
                            <dd className="font-mono text-sm">{eventContext.effectiveContext.surface}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("audience")}</dt>
                            <dd className="font-mono text-sm">{eventContext.effectiveContext.audience}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{t("trigger")}</dt>
                            <dd className="font-mono text-sm">{eventContext.effectiveContext.trigger}</dd>
                          </div>
                        </dl>
                        <div className={`${OPERATOR_WARNING_CALLOUT_PANEL_CLASS} text-xs text-muted-foreground`}>
                          <p className="font-medium text-foreground">{t("coordinateRuntimeNotice")}</p>
                          <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                            <div>
                              <dt>{t("storedContext")}</dt>
                              <dd className="font-mono">
                                {eventContext.storedContext === null
                                  ? t("none")
                                  : `${eventContext.storedContext.surface} / ${eventContext.storedContext.audience} / ${eventContext.storedContext.trigger}`}
                              </dd>
                            </div>
                            <div>
                              <dt>{t("effectiveContext")}</dt>
                              <dd className="font-mono">
                                {eventContext.effectiveContext.surface} / {eventContext.effectiveContext.audience} / {eventContext.effectiveContext.trigger}
                              </dd>
                            </div>
                            <div>
                              <dt>{t("coordinateControlsRuntimeEffective")}</dt>
                              <dd className="font-mono">
                                {eventContext.coordinateControlsRuntimeEffective
                                  ? t("enabled")
                                  : t("storedOnly")}
                              </dd>
                            </div>
                          </dl>
                          {eventContext.storedDiffersFromEffective ? (
                            <p className="mt-2">{t("storedDiffersFromEffective")}</p>
                          ) : null}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2 rounded-md border border-border/60 p-3">
                            <p className="text-sm font-medium">{t("persistedProfile")}</p>
                            {eventContext.persistedProfile === null ? (
                              <p className="text-xs text-muted-foreground">{t("none")}</p>
                            ) : (
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">id:</span>{" "}
                                  {eventContext.persistedProfile.id}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">version:</span>{" "}
                                  {eventContext.persistedProfile.version}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">defaults:</span>{" "}
                                  {eventContext.persistedProfile.defaultFieldIds.join(", ") || "—"}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 rounded-md border border-border/60 p-3">
                            <p className="text-sm font-medium">{t("activeIntent")}</p>
                            {eventContext.activeExposureIntent === null ? (
                              <p className="text-xs text-muted-foreground">{t("inheritProfile")}</p>
                            ) : (
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <p>
                                  <span className="font-medium text-foreground">mode:</span>{" "}
                                  {eventContext.activeExposureIntent.mode}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground">selected:</span>{" "}
                                  {eventContext.activeExposureIntent.selectedFieldIds.join(", ") || "—"}
                                </p>
                                {eventContext.activeExposureIntent.templateOverrideId ? (
                                  <p>
                                    <span className="font-medium text-foreground">template:</span>{" "}
                                    {eventContext.activeExposureIntent.templateOverrideId}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>

                        <ExposureEnginePreviewPanel
                          context={eventContext}
                          labels={{
                            title: t("enginePreviewTitle"),
                            empty: t("enginePreviewEmpty"),
                            samplePayload: t("samplePayload"),
                            engineSelected: t("engineSelected"),
                            reasonChain: t("reasonChain"),
                            appliedPolicies: t("appliedPolicies"),
                            noPolicies: t("noPolicies"),
                          }}
                        />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
