"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { SETTINGS_HUB_TEST_IDS } from "@/features/settings/settings-module-types";
import {
  fetchWorkspaceExposureCatalog,
  type WorkspaceExposureCatalogResponse,
} from "@/exposure/exposure-catalog-client";
import {
  createWorkspaceIntegration,
  disableIntegration,
  enableIntegration,
  fetchIntegrationDetail,
  fetchWorkspaceIntegrationMeta,
  fetchWorkspaceIntegrations,
  patchIntegration,
  testIntegrationConnection,
} from "@/integrations/integrations-client";
import {
  buildIntegrationPatchInput,
  channelIdFromConfig,
  findProviderSurfaceMeta,
  hasPlatformIntegrationConnection,
  hasRequiredEditConfigFields,
  integrationEditFieldKey,
  integrationStatusBadgeKey,
  isLegacyBackedIntegration,
  resolveIntegrationFallbackLabel,
  resolveIntegrationsWorkspaceScenario,
  seedEditValuesFromConnection,
  shouldShowIntegrationsScenarioCard,
} from "@/integrations/integrations-settings-logic";
import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
  IntegrationSurfaceFieldMeta,
  IntegrationTestConnectionResult,
  WorkspaceIntegrationSurfaceMetaResponse,
  WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";
import { IntegrationConnectionLoadWarningsBanner } from "@/integrations/IntegrationConnectionLoadWarningsBanner";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

export const INTEGRATIONS_SETTINGS_TEST_IDS = {
  page: "integrations-settings-page",
  list: "integrations-settings-list",
  detail: "integrations-settings-detail",
  emptyState: "integrations-settings-empty",
  testResult: "integrations-settings-test-result",
  scenario: "integrations-settings-scenario",
  workspaceScope: "integrations-settings-workspace-scope",
  addForm: "integrations-settings-add-form",
  catalogError: "integrations-settings-catalog-error",
} as const;

type IntegrationsSettingsClientProps = {
  readonly session: OperatorSessionContext;
  readonly workspaceId: string;
  readonly initialList?: WorkspaceIntegrationsListResponse | null;
  readonly initialMeta?: WorkspaceIntegrationSurfaceMetaResponse | null;
  readonly initialCatalog?: WorkspaceExposureCatalogResponse | null;
};

export function IntegrationsSettingsClient({
  session,
  workspaceId,
  initialList = null,
  initialMeta = null,
  initialCatalog = null,
}: IntegrationsSettingsClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("settings.integrations");
  const tErrors = useTranslations("settings.integrations.errors");
  const canManage = isAdminOrOwnerRole(session.role);

  const [list, setList] = useState<WorkspaceIntegrationsListResponse | null>(initialList);
  const [meta, setMeta] = useState<WorkspaceIntegrationSurfaceMetaResponse | null>(initialMeta);
  const [exposureCatalog, setExposureCatalog] =
    useState<WorkspaceExposureCatalogResponse | null>(initialCatalog);
  const [catalogError, setCatalogError] = useState<string | null>(
    initialCatalog === null ? "pending" : null,
  );
  const [catalogRetrying, setCatalogRetrying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialList?.items[0]?.id ?? null);
  const [detail, setDetail] = useState<IntegrationConnectionPublic | null>(null);
  const [loading, setLoading] = useState(canManage && initialList === null);
  const [metaLoading, setMetaLoading] = useState(canManage && initialMeta === null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<IntegrationTestConnectionResult | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [enableAfterSave, setEnableAfterSave] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchSuccess, setPatchSuccess] = useState(false);

  async function refreshExposureCatalog(): Promise<void> {
    setCatalogRetrying(true);
    try {
      const payload = await fetchWorkspaceExposureCatalog(workspaceId);
      setExposureCatalog(payload);
      setCatalogError(null);
    } catch {
      setExposureCatalog(null);
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

  const providerToCreate = useMemo(
    () =>
      meta?.providers.find((provider) => !hasPlatformIntegrationConnection(list, provider.id)) ??
      null,
    [list, meta]
  );
  const showCreateForm = useMemo(
    () =>
      !loading &&
      !metaLoading &&
      error === null &&
      providerToCreate !== null &&
      providerToCreate.configFields.length + providerToCreate.credentialFields.length > 0,
    [error, loading, metaLoading, providerToCreate]
  );

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const backgroundRefresh = initialList !== null && fetchNonce === 0;
    if (!backgroundRefresh) {
      setLoading(true);
      setError(null);
    }

    void fetchWorkspaceIntegrations(workspaceId)
      .then((payload) => {
        if (!cancelled) {
          setList(payload);
          setSelectedId((current) => {
            if (current !== null && payload.items.some((item) => item.id === current)) {
              return current;
            }
            return payload.items[0]?.id ?? null;
          });
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "INTEGRATIONS_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, fetchNonce, initialList, workspaceId]);

  useEffect(() => {
    if (!canManage) {
      setMetaLoading(false);
      return;
    }

    let cancelled = false;
    const backgroundRefresh = initialMeta !== null && fetchNonce === 0;
    if (!backgroundRefresh) {
      setMetaLoading(true);
    }

    void fetchWorkspaceIntegrationMeta(workspaceId)
      .then((payload) => {
        if (!cancelled) {
          setMeta(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "INTEGRATION_META_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, fetchNonce, initialMeta, workspaceId]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    let cancelled = false;

    void fetchWorkspaceExposureCatalog(workspaceId)
      .then((payload) => {
        if (!cancelled) {
          setExposureCatalog(payload);
          setCatalogError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExposureCatalog(null);
          setCatalogError(t("catalogLoadFailed"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, fetchNonce, initialCatalog, workspaceId]);

  useEffect(() => {
    if (!canManage || selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setTestResult(null);
    void fetchIntegrationDetail(selectedId)
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setDetailError(
            fetchError instanceof Error ? fetchError.message : "INTEGRATION_DETAIL_FAILED"
          );
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, selectedId]);

  const selectedFromList = useMemo(
    () => list?.items.find((item) => item.id === selectedId) ?? null,
    [list, selectedId]
  );

  const activeItem = detail ?? selectedFromList;
  const activeProviderSurface = useMemo(
    () => (activeItem === null ? null : findProviderSurfaceMeta(meta, activeItem.provider)),
    [activeItem, meta]
  );
  const showEditForm = useMemo(
    () =>
      activeItem !== null &&
      activeProviderSurface !== null &&
      activeItem.actionsAllowed.patch &&
      !isLegacyBackedIntegration(activeItem) &&
      activeProviderSurface.configFields.length + activeProviderSurface.credentialFields.length > 0,
    [activeItem, activeProviderSurface]
  );

  useEffect(() => {
    if (!showEditForm || activeItem === null || activeProviderSurface === null) {
      setEditValues({});
      setPatchError(null);
      setPatchSuccess(false);
      return;
    }
    setEditValues(seedEditValuesFromConnection(activeItem, activeProviderSurface));
    setPatchError(null);
    setPatchSuccess(false);
  }, [activeItem, activeProviderSurface, showEditForm]);

  const scenario = useMemo(
    () => (list === null ? null : resolveIntegrationsWorkspaceScenario(list)),
    [list]
  );
  const showScenarioCard = shouldShowIntegrationsScenarioCard(scenario);
  const hasSuppressedLegacy = useMemo(
    () => list?.items.some((item) => item.fallbackSuppressed) ?? false,
    [list]
  );

  async function refreshList(preferredId?: string): Promise<void> {
    const [payload, nextCatalog] = await Promise.all([
      fetchWorkspaceIntegrations(workspaceId),
      fetchWorkspaceExposureCatalog(workspaceId),
    ]);
    setList(payload);
    setExposureCatalog(nextCatalog);
    if (preferredId !== undefined) {
      setSelectedId(preferredId);
    }
  }

  function fieldKey(scope: "config" | "credentials", fieldId: string): string {
    return `${scope}.${fieldId}`;
  }

  function fieldInputValue(scope: "config" | "credentials", fieldId: string): string {
    return createValues[fieldKey(scope, fieldId)] ?? "";
  }

  function setFieldInputValue(
    scope: "config" | "credentials",
    fieldId: string,
    value: string
  ): void {
    setCreateValues((current) => ({
      ...current,
      [fieldKey(scope, fieldId)]: value,
    }));
  }

  function createFieldLabel(field: IntegrationSurfaceFieldMeta): string {
    if (field.id === "channelId") {
      return t("create.channelIdLabel");
    }
    if (field.id === "botToken") {
      return t("create.botTokenLabel");
    }
    return field.id;
  }

  function createFieldPlaceholder(field: IntegrationSurfaceFieldMeta): string | undefined {
    if (field.id === "channelId") {
      return t("create.channelIdPlaceholder");
    }
    if (field.id === "botToken") {
      return t("create.botTokenPlaceholder");
    }
    return undefined;
  }

  function createFieldHint(field: IntegrationSurfaceFieldMeta): string | null {
    if (field.id === "channelId") {
      return t("create.channelIdHint");
    }
    if (field.id === "botToken") {
      return t("create.botTokenHint");
    }
    return null;
  }

  function editFieldValue(scope: "config" | "credentials", fieldId: string): string {
    return editValues[integrationEditFieldKey(scope, fieldId)] ?? "";
  }

  function setEditFieldValue(
    scope: "config" | "credentials",
    fieldId: string,
    value: string
  ): void {
    setPatchSuccess(false);
    setEditValues((current) => ({
      ...current,
      [integrationEditFieldKey(scope, fieldId)]: value,
    }));
  }

  function editFieldLabel(field: IntegrationSurfaceFieldMeta): string {
    if (field.id === "channelId") {
      return t("edit.channelIdLabel");
    }
    if (field.id === "botToken") {
      return t("edit.botTokenLabel");
    }
    return field.id;
  }

  function editFieldPlaceholder(field: IntegrationSurfaceFieldMeta): string | undefined {
    if (field.id === "channelId") {
      return t("edit.channelIdPlaceholder");
    }
    if (field.id === "botToken") {
      return t("edit.botTokenPlaceholder");
    }
    return undefined;
  }

  function editFieldHint(field: IntegrationSurfaceFieldMeta): string | null {
    if (field.id === "channelId") {
      return t("edit.channelIdHint");
    }
    if (field.id === "botToken") {
      return t("edit.botTokenHint");
    }
    return null;
  }

  function hasMissingRequiredFields(provider: IntegrationProviderSurfaceMeta): boolean {
    return [...provider.configFields, ...provider.credentialFields].some((field) => {
      if (!field.requiredOnCreate) {
        return false;
      }
      const scope = field.kind === "secret" ? "credentials" : "config";
      return fieldInputValue(scope, field.id).trim().length === 0;
    });
  }

  async function handleCreateIntegration(): Promise<void> {
    if (providerToCreate === null) {
      return;
    }
    if (hasMissingRequiredFields(providerToCreate)) {
      setCreateError("INTEGRATION_CREATE_VALIDATION_REQUIRED");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(false);
    try {
      const config = Object.fromEntries(
        providerToCreate.configFields
          .map((field) => [field.id, fieldInputValue("config", field.id).trim()] as const)
          .filter(([, value]) => value.length > 0)
      );
      const credentials = Object.fromEntries(
        providerToCreate.credentialFields
          .map((field) => [field.id, fieldInputValue("credentials", field.id).trim()] as const)
          .filter(([, value]) => value.length > 0)
      );
      let created = await createWorkspaceIntegration(workspaceId, {
        provider: providerToCreate.id,
        config,
        credentials,
      });
      if (enableAfterSave && created.actionsAllowed.enable && !created.enabled) {
        created = await enableIntegration(created.id);
      }
      setCreateValues({});
      setCreateSuccess(true);
      setDetail(created);
      await refreshList(created.id);
    } catch (actionError: unknown) {
      setCreateError(
        actionError instanceof Error ? actionError.message : "INTEGRATION_CREATE_FAILED"
      );
    } finally {
      setCreateLoading(false);
    }
  }

  async function handlePatchIntegration(): Promise<void> {
    if (activeItem === null || activeProviderSurface === null || !activeItem.actionsAllowed.patch) {
      return;
    }
    if (!hasRequiredEditConfigFields(activeProviderSurface, editValues)) {
      setPatchError("INTEGRATION_PATCH_VALIDATION_REQUIRED");
      return;
    }

    const patchInput = buildIntegrationPatchInput(
      activeProviderSurface,
      activeItem.config,
      editValues
    );
    if (patchInput === null) {
      setPatchError("INTEGRATION_PATCH_NO_CHANGES");
      return;
    }

    setPatchLoading(true);
    setPatchError(null);
    setPatchSuccess(false);
    try {
      const updated = await patchIntegration(activeItem.id, patchInput);
      setDetail(updated);
      setEditValues(seedEditValuesFromConnection(updated, activeProviderSurface));
      setPatchSuccess(true);
      await refreshList(updated.id);
    } catch (actionError: unknown) {
      setPatchError(
        actionError instanceof Error ? actionError.message : "INTEGRATION_PATCH_FAILED"
      );
    } finally {
      setPatchLoading(false);
    }
  }

  async function handleEnable(): Promise<void> {
    if (activeItem === null || !activeItem.actionsAllowed.enable) {
      return;
    }
    setActionLoading(true);
    setDetailError(null);
    try {
      const updated = await enableIntegration(activeItem.id);
      setDetail(updated);
      await refreshList(updated.id);
    } catch (actionError: unknown) {
      setDetailError(
        actionError instanceof Error ? actionError.message : "INTEGRATION_ENABLE_FAILED"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisable(): Promise<void> {
    if (activeItem === null || !activeItem.actionsAllowed.disable) {
      return;
    }
    setActionLoading(true);
    setDetailError(null);
    try {
      const updated = await disableIntegration(activeItem.id);
      setDetail(updated);
      await refreshList(updated.id);
    } catch (actionError: unknown) {
      setDetailError(
        actionError instanceof Error ? actionError.message : "INTEGRATION_DISABLE_FAILED"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTestConnection(): Promise<void> {
    if (activeItem === null || !activeItem.actionsAllowed.test) {
      return;
    }
    setActionLoading(true);
    setDetailError(null);
    setTestResult(null);
    try {
      const result = await testIntegrationConnection(activeItem.id);
      setTestResult(result);
      if (activeItem.backingSource === "integration_connection") {
        const refreshed = await fetchIntegrationDetail(activeItem.id);
        setDetail(refreshed);
        await refreshList(activeItem.id);
      }
    } catch (actionError: unknown) {
      setDetailError(
        actionError instanceof Error ? actionError.message : "INTEGRATION_TEST_FAILED"
      );
    } finally {
      setActionLoading(false);
    }
  }

  function backingBadge(item: IntegrationConnectionPublic) {
    if (isLegacyBackedIntegration(item)) {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/60 text-amber-900 dark:text-amber-100"
          data-testid="integration-backing-legacy"
        >
          {t("badges.legacy")}
        </Badge>
      );
    }
    return (
      <Badge variant="default" data-testid="integration-backing-new">
        {t("badges.integrationConnection")}
      </Badge>
    );
  }

  function statusBadge(item: IntegrationConnectionPublic) {
    const key = integrationStatusBadgeKey(item);
    return (
      <Badge
        variant={key === "error" ? "destructive" : "outline"}
        data-testid="integration-status-badge"
      >
        {t(`badges.${key}`)}
      </Badge>
    );
  }

  function connectionStatusDescription(item: IntegrationConnectionPublic): string {
    const key = integrationStatusBadgeKey(item);
    if (key === "error") {
      return t("detail.statusDescriptions.error");
    }
    if (!item.enabled) {
      return t("detail.statusDescriptions.disabled");
    }
    return t("detail.statusDescriptions.enabled");
  }

  function fallbackLabelBadge(item: IntegrationConnectionPublic) {
    const fallback = resolveIntegrationFallbackLabel(item);
    if (fallback === "not_applicable") {
      return null;
    }
    if (fallback === "active") {
      return (
        <Badge variant="outline" data-testid="integration-fallback-active">
          {t("badges.fallbackActive")}
        </Badge>
      );
    }
    if (fallback === "suppressed") {
      return (
        <Badge variant="outline" data-testid="integration-fallback-suppressed">
          {t("badges.fallbackSuppressed")}
        </Badge>
      );
    }
    return null;
  }

  if (!canManage) {
    return (
      <div className="space-y-6" data-testid={SETTINGS_HUB_TEST_IDS.integrationsPage}>
        <Card data-denali-surface="card" className="shadow-sm">
          <CardContent className="pt-6 text-sm text-muted-foreground">{t("forbidden")}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-testid={SETTINGS_HUB_TEST_IDS.integrationsPage}
      data-exposure-catalog-field-count={exposureCatalog?.fields.length ?? 0}
    >
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />
      <p
        className="text-xs text-muted-foreground"
        data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.workspaceScope}
      >
        {t("workspaceScope", { workspaceId })}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || actionLoading}
          onClick={() => setFetchNonce((value) => value + 1)}
        >
          {t("refresh")}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/settings">{t("backToHub")}</Link>
        </Button>
      </div>

      {catalogError !== null && catalogError !== "pending" ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
          role="alert"
          data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.catalogError}
        >
          <p className="text-destructive">{catalogError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={catalogRetrying}
            onClick={() => void refreshExposureCatalog()}
          >
            {catalogRetrying ? t("catalogRetrying") : t("catalogRetry")}
          </Button>
        </div>
      ) : null}

      {showScenarioCard ? (
        <Card
          data-denali-surface="card"
          className="shadow-sm"
          data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.scenario}
          data-scenario={scenario}
        >
          <CardHeader>
            <CardTitle>{t(`scenarios.${scenario}.title`)}</CardTitle>
            <CardDescription>{t(`scenarios.${scenario}.description`)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {list !== null ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("summary.title")}</CardTitle>
            <CardDescription>
              {t("summary.description", {
                integrationCount: formatLocalizedNumber(
                  list.summary.integrationConnectionCount,
                  locale
                ),
                legacyCount: formatLocalizedNumber(list.summary.legacyConnectionCount, locale),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {list.summary.activeDeliverySource === null ? (
              t("summary.noActiveSource")
            ) : (
              <p data-testid="integrations-active-delivery-source">
                {t(`summary.activeSource.${list.summary.activeDeliverySource}`)}
              </p>
            )}
            {hasSuppressedLegacy ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-100">
                {t("summary.legacyFallbackSuppressed")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(loading && list === null) || (metaLoading && meta === null) ? (
        <Skeleton className="h-48 w-full max-w-5xl" />
      ) : null}

      {error !== null ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
          {error === "INTEGRATION_SYSTEM_NOT_READY" ? (
            <p className="text-sm text-muted-foreground">{t("subsystemNotReadyHint")}</p>
          ) : null}
        </div>
      ) : null}

      {showCreateForm ? (
        <Card
          data-denali-surface="card"
          className="max-w-5xl shadow-sm"
          data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.addForm}
        >
          <CardHeader>
            <CardTitle>{t("create.title")}</CardTitle>
            <CardDescription>{t("create.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providerToCreate?.configFields.map((field) => {
              const inputId = `integration-config-${field.id}`;
              const hint = createFieldHint(field);
              return (
                <div key={inputId} className="space-y-2">
                  <Label htmlFor={inputId}>{createFieldLabel(field)}</Label>
                  <Input
                    id={inputId}
                    value={fieldInputValue("config", field.id)}
                    onChange={(event) => setFieldInputValue("config", field.id, event.target.value)}
                    placeholder={createFieldPlaceholder(field)}
                    autoComplete="off"
                    disabled={createLoading || actionLoading}
                  />
                  {hint !== null ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
                </div>
              );
            })}
            {providerToCreate?.credentialFields.map((field) => {
              const inputId = `integration-credential-${field.id}`;
              const hint = createFieldHint(field);
              return (
                <div key={inputId} className="space-y-2">
                  <Label htmlFor={inputId}>{createFieldLabel(field)}</Label>
                  <Input
                    id={inputId}
                    type={field.kind === "secret" ? "password" : "text"}
                    value={fieldInputValue("credentials", field.id)}
                    onChange={(event) =>
                      setFieldInputValue("credentials", field.id, event.target.value)
                    }
                    placeholder={createFieldPlaceholder(field)}
                    autoComplete={field.kind === "secret" ? "new-password" : "off"}
                    disabled={createLoading || actionLoading}
                  />
                  {hint !== null ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
                </div>
              );
            })}
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="integration-enable-after-save"
                checked={enableAfterSave}
                onChange={(event) => setEnableAfterSave(event.target.checked)}
                disabled={createLoading || actionLoading}
              />
              <Label htmlFor="integration-enable-after-save">{t("create.enableAfterSave")}</Label>
            </div>
            {createError !== null ? (
              <p className="text-sm text-destructive">
                {createError === "INTEGRATION_CREATE_VALIDATION_REQUIRED"
                  ? t("create.validationRequired")
                  : resolveCodedErrorMessage(tErrors, createError)}
              </p>
            ) : null}
            {createSuccess ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
                {t("create.success")}
              </p>
            ) : null}
            <Button
              type="button"
              disabled={createLoading || actionLoading}
              onClick={() => void handleCreateIntegration()}
            >
              {createLoading ? t("create.submitting") : t("create.submit")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && error === null && list !== null && list.items.length === 0 ? (
        <Card
          data-denali-surface="card"
          data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.emptyState}
          className="shadow-sm"
        >
          <CardHeader>
            <CardTitle>{t("empty.title")}</CardTitle>
            <CardDescription>{t("empty.description")}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!loading && error === null && list !== null && list.items.length > 0 ? (
        <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card
            data-denali-surface="card"
            className="shadow-sm"
            data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.list}
          >
            <CardHeader>
              <CardTitle>{t("listTitle", { count: list.items.length })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left transition hover:bg-muted/50 ${
                    selectedId === item.id ? "border-primary bg-muted/40" : "border-border"
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium capitalize">{item.provider}</span>
                    {backingBadge(item)}
                    {statusBadge(item)}
                    {item.isActiveDeliverySource ? (
                      <Badge variant="outline" data-testid="integration-active-delivery">
                        {t("badges.activeDelivery")}
                      </Badge>
                    ) : null}
                    {fallbackLabelBadge(item)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("rowMeta", { channelId: channelIdFromConfig(item.config) })}
                  </p>
                  {isLegacyBackedIntegration(item) ? (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                      {t("badges.legacyWarning")}
                    </p>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card
            data-denali-surface="card"
            className="shadow-sm"
            data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.detail}
          >
            <CardHeader>
              <CardTitle>{t("detail.title")}</CardTitle>
              {activeItem !== null ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {backingBadge(activeItem)}
                  {statusBadge(activeItem)}
                  {activeItem.isActiveDeliverySource ? (
                    <Badge variant="outline">{t("badges.activeDelivery")}</Badge>
                  ) : null}
                  {fallbackLabelBadge(activeItem)}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {detailLoading ? <Skeleton className="h-32 w-full" /> : null}
              {detailError !== null ? (
                <p className="text-sm text-destructive">
                  {resolveCodedErrorMessage(tErrors, detailError)}
                </p>
              ) : null}

              {detailError === null && detail !== null ? (
                <IntegrationConnectionLoadWarningsBanner
                  loadWarnings={detail.loadWarnings}
                  tourPublishedPolicyDriftLabel={t("tourPublishedPolicyDriftBanner")}
                  detailDegradedLabel={t("detailDegradedBanner")}
                  testId="integrations-connection-load-warnings"
                />
              ) : null}

              {activeItem !== null && !detailLoading ? (
                <>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
                    <p className="font-medium">{t("detail.exposureMovedTitle")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {t("detail.exposureMovedDescription")}
                    </p>
                    <Button asChild className="mt-3" size="sm">
                      <Link href="/settings/exposure">
                        {t("detail.openExposureSettings")}
                      </Link>
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{t("detail.overviewTitle")}</p>
                        <p className="text-sm text-muted-foreground">
                          {connectionStatusDescription(activeItem)}
                        </p>
                      </div>
                      {statusBadge(activeItem)}
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-md bg-muted/40 p-3">
                        <dt className="text-xs text-muted-foreground">{t("detail.channelId")}</dt>
                        <dd className="mt-1 font-medium">
                          {channelIdFromConfig(activeItem.config)}
                        </dd>
                      </div>
                      <div className="rounded-md bg-muted/40 p-3">
                        <dt className="text-xs text-muted-foreground">{t("detail.hasSecret")}</dt>
                        <dd className="mt-1 font-medium">
                          {activeItem.hasSecret ? t("detail.yes") : t("detail.no")}
                        </dd>
                      </div>
                    </dl>
                    {testResult !== null ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {testResult.ok
                          ? t("detail.lastTestSuccess")
                          : t("detail.lastTestFailure")}
                      </p>
                    ) : null}
                  </div>

                  <details className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                    <summary className="cursor-pointer select-none font-medium text-foreground">
                      {t("detail.technicalDetails")}
                    </summary>
                    <dl className="mt-3 grid gap-2">
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{t("detail.connectionId")}</dt>
                        <dd className="font-mono text-xs">{activeItem.id}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{t("detail.backingSource")}</dt>
                        <dd>
                          {isLegacyBackedIntegration(activeItem)
                            ? t("badges.legacy")
                            : t("badges.integrationConnection")}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{t("detail.status")}</dt>
                        <dd>{activeItem.status}</dd>
                      </div>
                      {activeItem.legacySourceId !== null ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">{t("detail.legacySourceId")}</dt>
                          <dd className="font-mono text-xs">{activeItem.legacySourceId}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>

                  {activeItem.fallbackSuppressed ? (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                      {t("detail.fallbackSuppressed")}
                    </p>
                  ) : null}

                  {isLegacyBackedIntegration(activeItem) ? (
                    <p className="text-sm text-muted-foreground">{t("detail.legacyReadOnly")}</p>
                  ) : null}

                  {showEditForm && activeProviderSurface !== null ? (
                    <div
                      className="space-y-4 rounded-md border border-border p-4"
                      data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.editForm}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t("edit.title")}</p>
                        <p className="text-xs text-muted-foreground">{t("edit.description")}</p>
                      </div>
                      {activeProviderSurface.configFields.map((field) => {
                        const inputId = `integration-edit-config-${field.id}`;
                        const hint = editFieldHint(field);
                        return (
                          <div key={inputId} className="space-y-2">
                            <Label htmlFor={inputId}>{editFieldLabel(field)}</Label>
                            <Input
                              id={inputId}
                              value={editFieldValue("config", field.id)}
                              onChange={(event) =>
                                setEditFieldValue("config", field.id, event.target.value)
                              }
                              placeholder={editFieldPlaceholder(field)}
                              autoComplete="off"
                              disabled={patchLoading || actionLoading}
                            />
                            {hint !== null ? (
                              <p className="text-xs text-muted-foreground">{hint}</p>
                            ) : null}
                          </div>
                        );
                      })}
                      {activeProviderSurface.credentialFields.map((field) => {
                        const inputId = `integration-edit-credential-${field.id}`;
                        const hint = editFieldHint(field);
                        return (
                          <div key={inputId} className="space-y-2">
                            <Label htmlFor={inputId}>{editFieldLabel(field)}</Label>
                            <Input
                              id={inputId}
                              type={field.kind === "secret" ? "password" : "text"}
                              value={editFieldValue("credentials", field.id)}
                              onChange={(event) =>
                                setEditFieldValue("credentials", field.id, event.target.value)
                              }
                              placeholder={editFieldPlaceholder(field)}
                              autoComplete={field.kind === "secret" ? "new-password" : "off"}
                              disabled={patchLoading || actionLoading}
                            />
                            {hint !== null ? (
                              <p className="text-xs text-muted-foreground">{hint}</p>
                            ) : null}
                          </div>
                        );
                      })}
                      {patchError !== null ? (
                        <p className="text-sm text-destructive">
                          {patchError === "INTEGRATION_PATCH_VALIDATION_REQUIRED"
                            ? t("edit.validationRequired")
                            : patchError === "INTEGRATION_PATCH_NO_CHANGES"
                              ? t("edit.noChanges")
                              : resolveCodedErrorMessage(tErrors, patchError)}
                        </p>
                      ) : null}
                      {patchSuccess ? (
                        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
                          {t("edit.success")}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={patchLoading || actionLoading}
                        onClick={() => void handlePatchIntegration()}
                      >
                        {patchLoading ? t("edit.submitting") : t("edit.submit")}
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        actionLoading ||
                        !activeItem.actionsAllowed.enable ||
                        activeItem.enabled ||
                        isLegacyBackedIntegration(activeItem)
                      }
                      onClick={() => void handleEnable()}
                    >
                      {t("actions.enable")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        actionLoading ||
                        !activeItem.actionsAllowed.disable ||
                        !activeItem.enabled ||
                        isLegacyBackedIntegration(activeItem)
                      }
                      onClick={() => void handleDisable()}
                    >
                      {t("actions.disable")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={actionLoading || !activeItem.actionsAllowed.test}
                      onClick={() => void handleTestConnection()}
                    >
                      {t("actions.testConnection")}
                    </Button>
                  </div>

                  {testResult !== null ? (
                    <div
                      data-testid={INTEGRATIONS_SETTINGS_TEST_IDS.testResult}
                      className={`rounded-md border p-3 text-sm ${
                        testResult.ok
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-destructive/40 bg-destructive/10"
                      }`}
                    >
                      <p className="font-medium">
                        {testResult.ok ? t("test.successTitle") : t("test.failureTitle")}
                      </p>
                      {testResult.message !== undefined ? <p>{testResult.message}</p> : null}
                      {testResult.code !== undefined ? (
                        <p className="text-xs text-muted-foreground">{testResult.code}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("test.meta", {
                          backing: isLegacyBackedIntegration(activeItem)
                            ? t("badges.legacy")
                            : t("badges.integrationConnection"),
                          testedAt: testResult.testedAt,
                        })}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
