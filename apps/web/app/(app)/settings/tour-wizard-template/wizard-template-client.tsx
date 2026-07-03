"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";
import { LayoutTemplate, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  resolveWizardTemplateUserError,
  type WizardTemplateErrorResolution,
} from "@/features/settings/wizard-template-copy";
import {
  WIZARD_TEMPLATE_TEST_IDS,
  type WizardTemplateConfigResponse,
  type WizardTemplatePayload,
} from "@/features/settings/wizard-template-types";
import {
  buildWizardTemplatePutBody,
  parseWizardTemplateResponse,
} from "@/features/settings/wizard-template-logic";
import {
  countWizardTemplateSelectedFields,
  validateWizardTemplateSavable,
} from "@/tours/wizard-template-gate-logic";
import { loadDenaliFullWizardTemplatePreset } from "@/bootstrap/denali-wizard-template-preset";
import { resolveBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import { WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS } from "@/bootstrap/wizard-create-bindings.generated";
import {
  applyWizardTemplatePreset,
  buildWizardTemplateCatalogFromPlugin,
  filterWizardTemplateCatalog,
  isWizardTemplateCatalogFieldSelected,
  resolveWizardTemplateFieldRef,
  toggleWizardTemplateCatalogField,
  updateWizardTemplateFieldOverlay,
  WIZARD_TEMPLATE_CATALOG_TEST_IDS,
  type WizardTemplateCatalogStep,
} from "@/tours/wizard-template-catalog-logic";
import {
  resolveDenaliFieldKindLabel,
  resolveDenaliFieldLabel,
} from "@/i18n/denali-wizard-labels";
import {
  formatWizardTemplateFieldKindLabel,
  resolveWizardTemplateFieldLabel,
} from "@/tours/wizard-template-field-labels";
import {
  DENALI_WIZARD_PHOTOS_STEP_ID,
  isDenaliWizardTemplateLongDescriptionVisible,
  patchDenaliWizardTemplateLongDescriptionVisibility,
} from "@app-tour/workspace-denali/settings/wizard-template-long-description";
import { resolveDenaliWizardTemplateCatalogFieldMeta } from "@app-tour/workspace-denali/settings/wizard-template-catalog-meta";
import {
  isDenaliFrozenTemplateCanonicalPath,
  normalizeDenaliWizardTemplatePayloadSteps,
} from "@app-tour/workspace-denali";
import { resolveDenaliWizardTemplateFieldDisplayHints } from "@/tours/wizard-template-field-display-hints";

type WizardTemplateClientProps = {
  readonly session: OperatorSessionContext;
  readonly pluginId: string;
  readonly initialTemplateResponse?: unknown | null;
  readonly initialCatalog?: readonly WizardTemplateCatalogStep[];
};

function createEmptyWizardTemplatePayload(): WizardTemplatePayload {
  return {
    seedLabel: "",
    sections: [],
    published: false,
    steps: [],
  };
}


function normalizeDenaliWizardTemplatePayloadForSettings(
  pluginId: string,
  payload: WizardTemplatePayload
): WizardTemplatePayload {
  if (pluginId !== "denali" || payload.published !== true) {
    return payload;
  }
  return normalizeDenaliWizardTemplatePayloadSteps(payload) as WizardTemplatePayload;
}

function parseInitialWizardTemplatePayload(response: unknown | null | undefined): WizardTemplatePayload | null {
  if (response == null) {
    return null;
  }
  try {
    return parseWizardTemplateResponse(response as WizardTemplateConfigResponse);
  } catch {
    return null;
  }
}

export function WizardTemplateClient({
  session,
  pluginId,
  initialTemplateResponse = null,
  initialCatalog,
}: WizardTemplateClientProps) {
  const t = useTranslations("settings.wizardTemplate");
  const tDenali = useTranslations("denali");
  const canManage = isAdminOrOwnerRole(session.role);
  const skipInitialTemplateFetchRef = useRef(initialTemplateResponse != null);
  const [payload, setPayload] = useState<WizardTemplatePayload>(() => {
    const parsed = parseInitialWizardTemplatePayload(initialTemplateResponse);
    if (parsed == null) {
      return createEmptyWizardTemplatePayload();
    }
    return normalizeDenaliWizardTemplatePayloadForSettings(pluginId, parsed);
  });
  const catalog = useMemo(() => {
    if (initialCatalog != null) {
      return initialCatalog;
    }
    try {
      return buildWizardTemplateCatalogFromPlugin(resolveBootstrapWorkspacePlugin(pluginId));
    } catch {
      return [];
    }
  }, [initialCatalog, pluginId]);
  const [fieldQuery, setFieldQuery] = useState("");
  const [loading, setLoading] = useState(initialTemplateResponse == null);
  const [saving, setSaving] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const showDenaliFullTemplate = WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS.has(pluginId);

  const formatWizardError = useCallback(
    (resolution: WizardTemplateErrorResolution): string => {
      if (resolution.type === "raw") {
        return resolution.message;
      }
      return resolution.values
        ? t(resolution.key, resolution.values)
        : t(resolution.key);
    },
    [t]
  );

  const selectedFieldCount = countWizardTemplateSelectedFields(payload.steps);

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = fieldQuery.trim().toLowerCase();
    return filterWizardTemplateCatalog(catalog, fieldQuery, (field, stepLabel) => {
      const label =
        pluginId === "denali"
          ? resolveDenaliFieldLabel(tDenali, field.canonicalPath)
          : resolveWizardTemplateFieldLabel(field.canonicalPath, pluginId);
      const kindLabel =
        pluginId === "denali"
          ? resolveDenaliFieldKindLabel(tDenali, field.kind)
          : formatWizardTemplateFieldKindLabel(field.kind);
      return (
        field.canonicalPath.toLowerCase().includes(normalizedQuery) ||
        label.toLowerCase().includes(normalizedQuery) ||
        stepLabel.toLowerCase().includes(normalizedQuery) ||
        kindLabel.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [catalog, fieldQuery, pluginId, tDenali]);

  useEffect(() => {
    if (skipInitialTemplateFetchRef.current) {
      skipInitialTemplateFetchRef.current = false;
      return;
    }

    let cancelled = false;
    void fetch("/api/settings/tour-wizard-template", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`WIZARD_TEMPLATE_HTTP_${response.status}`);
        }
        return (await response.json()) as WizardTemplateConfigResponse;
      })
      .then((config) => {
        if (!cancelled) {
          setPayload(
            normalizeDenaliWizardTemplatePayloadForSettings(
              pluginId,
              parseWizardTemplateResponse(config)
            )
          );
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(formatWizardError(resolveWizardTemplateUserError(fetchError)));
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
  }, [formatWizardError]);

  const handleLoadFullTemplate = async () => {
    if (!canManage || !showDenaliFullTemplate) {
      return;
    }

    setLoadingPreset(true);
    setError(null);
    setSaved(false);
    try {
      const seedLabel = payload.seedLabel.trim();
      const preset = await loadDenaliFullWizardTemplatePreset(
        seedLabel.length > 0 ? seedLabel : undefined
      );
      setPayload((current) => applyWizardTemplatePreset(preset, catalog, current));
    } catch (loadError: unknown) {
      setError(formatWizardError(resolveWizardTemplateUserError(loadError)));
    } finally {
      setLoadingPreset(false);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const validationError = validateWizardTemplateSavable(payload);
    if (validationError !== null) {
      setError(formatWizardError(resolveWizardTemplateUserError(new Error(validationError))));
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/settings/tour-wizard-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWizardTemplatePutBody(payload)),
      });
      if (!response.ok) {
        throw new Error(`WIZARD_TEMPLATE_SAVE_HTTP_${response.status}`);
      }
      const savedConfig = (await response.json()) as WizardTemplateConfigResponse;
      setPayload(parseWizardTemplateResponse(savedConfig));
      setSaved(true);
    } catch (saveError: unknown) {
      setError(formatWizardError(resolveWizardTemplateUserError(saveError)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={WIZARD_TEMPLATE_TEST_IDS.page}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {!canManage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("readOnlyBanner")}
        </p>
      ) : null}

      {loading ? <Skeleton className="h-40 w-full" /> : null}
      {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && catalog.length === 0 ? (
        <p className="text-sm text-destructive">{t("errors.loadFailed")}</p>
      ) : null}
      {saved ? (
        <p className="text-sm text-green-600" data-testid={WIZARD_TEMPLATE_TEST_IDS.success}>
          {t("success")}
        </p>
      ) : null}

      {!loading && catalog.length > 0 ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("cardTitle")}</CardTitle>
            <CardDescription>{t("cardDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              data-testid={WIZARD_TEMPLATE_TEST_IDS.form}
              onSubmit={(event) => void handleSave(event)}
            >
              <div className="space-y-2">
                <Label htmlFor="wizard-seed-label">{t("seedLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("seedHelper")}</p>
                <Input
                  id="wizard-seed-label"
                  data-testid={WIZARD_TEMPLATE_TEST_IDS.seedInput}
                  value={payload.seedLabel}
                  onChange={(event) =>
                    setPayload((current) => ({ ...current, seedLabel: event.target.value }))
                  }
                  placeholder={t("seedPlaceholder")}
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="wizard-publish"
                    data-testid={WIZARD_TEMPLATE_TEST_IDS.publishToggle}
                    checked={payload.published === true}
                    onChange={(event) =>
                      setPayload((current) => ({ ...current, published: event.target.checked }))
                    }
                    disabled={!canManage}
                  />
                  <Label htmlFor="wizard-publish">{t("publishLabel")}</Label>
                </div>
                <p className="text-xs text-muted-foreground">{t("publishHelper")}</p>
                {payload.published === true && selectedFieldCount === 0 ? (
                  <p className="text-xs text-destructive">{t("errors.publishNoFields")}</p>
                ) : null}
              </div>

              {showDenaliFullTemplate && canManage ? (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <p className="text-xs text-muted-foreground">{t("loadFullTemplateHelper")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingPreset || catalog.length === 0}
                    data-testid={WIZARD_TEMPLATE_TEST_IDS.loadFullTemplateButton}
                    onClick={() => void handleLoadFullTemplate()}
                  >
                    <LayoutTemplate className="me-1 size-4" />
                    {t("loadFullTemplateButton")}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-4" data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldList}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t("fieldsHeading")}</p>
                    <p className="text-xs text-muted-foreground">{t("fieldsHelper")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("selectedCount", { count: selectedFieldCount })}
                  </p>
                </div>
                <Input
                  data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldSearch}
                  value={fieldQuery}
                  onChange={(event) => setFieldQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="max-w-md"
                  disabled={!canManage && catalog.length === 0}
                />
                {filteredCatalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noSearchResults")}</p>
                ) : null}
                {filteredCatalog.map((step) => (
                  <details key={step.stepId} open className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-semibold">{step.label}</summary>
                    {pluginId === "denali" && step.stepId === DENALI_WIZARD_PHOTOS_STEP_ID ? (
                      <div className="mt-3 space-y-1 rounded-md border border-dashed p-3">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="wizard-photos-show-long-description"
                            data-testid={WIZARD_TEMPLATE_TEST_IDS.photosStepShowLongDescription}
                            checked={isDenaliWizardTemplateLongDescriptionVisible(payload.fieldRulesOverlay)}
                            onChange={(event) =>
                              setPayload((current) => ({
                                ...current,
                                fieldRulesOverlay: patchDenaliWizardTemplateLongDescriptionVisibility(
                                  current.fieldRulesOverlay,
                                  event.target.checked
                                ),
                              }))
                            }
                            disabled={!canManage}
                          />
                          <div className="space-y-0.5">
                            <Label htmlFor="wizard-photos-show-long-description">
                              {t("photosStep.showLongDescription")}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {t("photosStep.showLongDescriptionHelper")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <ul className="mt-3 space-y-2">
                      {step.fields.map((field) => {
                        const fieldLabel =
                          pluginId === "denali"
                            ? resolveDenaliFieldLabel(tDenali, field.canonicalPath)
                            : resolveWizardTemplateFieldLabel(field.canonicalPath, pluginId);
                        const kindLabel =
                          pluginId === "denali"
                            ? resolveDenaliFieldKindLabel(tDenali, field.kind)
                            : formatWizardTemplateFieldKindLabel(field.kind);
                        const stepFieldPaths = step.fields.map((entry) => entry.canonicalPath);
                        const fieldMeta =
                          pluginId === "denali"
                            ? resolveDenaliWizardTemplateCatalogFieldMeta(
                                field.canonicalPath,
                                step.stepId,
                                stepFieldPaths
                              )
                            : null;
                        const templateFrozen = fieldMeta?.templateFrozen === true;
                        const checked =
                          templateFrozen ||
                          isWizardTemplateCatalogFieldSelected(payload.steps ?? [], field.canonicalPath);
                        const selectable = field.selectable;
                        const overlay = resolveWizardTemplateFieldRef(
                          payload.steps ?? [],
                          field.canonicalPath
                        );
                        const requiredLocked =
                          templateFrozen &&
                          (fieldMeta?.templateFrozenRequired === true ||
                            fieldMeta?.registryDefaultRequired === true);
                        const fieldDisplayHints =
                          fieldMeta != null
                            ? resolveDenaliWizardTemplateFieldDisplayHints(
                                (key, values) => t(key, values),
                                tDenali,
                                (path) => resolveDenaliFieldLabel(tDenali, path),
                                fieldMeta
                              )
                            : null;
                        return (
                          <li key={field.canonicalPath} className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                id={`wizard-field-${field.canonicalPath}`}
                                data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldToggle}
                                data-canonical-path={field.canonicalPath}
                                data-selectable={selectable ? "true" : "false"}
                                data-template-frozen={templateFrozen ? "true" : "false"}
                                checked={checked}
                                onChange={(event) =>
                                  setPayload((current) => ({
                                    ...current,
                                    steps: toggleWizardTemplateCatalogField(
                                      current.steps ?? [],
                                      field,
                                      event.target.checked,
                                      pluginId === "denali"
                                        ? {
                                            isFrozen: isDenaliFrozenTemplateCanonicalPath,
                                          }
                                        : undefined
                                    ),
                                  }))
                                }
                                disabled={!canManage || !selectable || templateFrozen}
                              />
                              <div className="space-y-0.5">
                                <Label htmlFor={`wizard-field-${field.canonicalPath}`}>
                                  {fieldLabel}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  <span>{kindLabel}</span>
                                  {field.kind === "composite" ? (
                                    <span className="ms-2">{t("compositeHint")}</span>
                                  ) : null}
                                </p>
                                {fieldDisplayHints?.parentLabel != null ? (
                                  <p
                                    className="text-xs text-muted-foreground"
                                    data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldParent}
                                    data-canonical-path={field.canonicalPath}
                                  >
                                    {t("hints.parentField", { name: fieldDisplayHints.parentLabel })}
                                  </p>
                                ) : null}
                                {fieldDisplayHints != null &&
                                fieldDisplayHints.includesLabels.length > 0 ? (
                                  <p className="text-xs text-muted-foreground">
                                    {t("hints.compositeIncludes", {
                                      names: fieldDisplayHints.includesLabels.join("، "),
                                    })}
                                  </p>
                                ) : null}
                                {fieldDisplayHints?.createTourHint != null ? (
                                  <p
                                    className="text-xs text-muted-foreground"
                                    data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldCreateHint}
                                    data-canonical-path={field.canonicalPath}
                                  >
                                    {fieldDisplayHints.createTourHint}
                                  </p>
                                ) : null}
                                {!selectable ? (
                                  <p
                                    className="text-xs text-muted-foreground"
                                    data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldRoadmap}
                                    data-canonical-path={field.canonicalPath}
                                  >
                                    {t("hints.roadmapField")}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {checked && (selectable || templateFrozen) ? (
                              <div className="ms-6 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`wizard-required-${field.canonicalPath}`}
                                    data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldRequired}
                                    data-canonical-path={field.canonicalPath}
                                    checked={overlay?.required === true || requiredLocked}
                                    onChange={(event) =>
                                      setPayload((current) => ({
                                        ...current,
                                        steps: updateWizardTemplateFieldOverlay(
                                          current.steps ?? [],
                                          field.canonicalPath,
                                          { required: event.target.checked }
                                        ),
                                      }))
                                    }
                                    disabled={!canManage || requiredLocked}
                                  />
                                  <Label htmlFor={`wizard-required-${field.canonicalPath}`}>
                                    {t("requiredLabel")}
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`wizard-default-${field.canonicalPath}`}>
                                    {t("defaultLabel")}
                                  </Label>
                                  <Input
                                    id={`wizard-default-${field.canonicalPath}`}
                                    className="h-8 w-40"
                                    data-testid={WIZARD_TEMPLATE_CATALOG_TEST_IDS.fieldDefault}
                                    data-canonical-path={field.canonicalPath}
                                    value={overlay?.defaultValue ?? ""}
                                    onChange={(event) =>
                                      setPayload((current) => ({
                                        ...current,
                                        steps: updateWizardTemplateFieldOverlay(
                                          current.steps ?? [],
                                          field.canonicalPath,
                                          { defaultValue: event.target.value }
                                        ),
                                      }))
                                    }
                                    disabled={!canManage}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ))}
              </div>

              {canManage ? (
                <Button
                  type="submit"
                  disabled={saving}
                  data-testid={WIZARD_TEMPLATE_TEST_IDS.saveButton}
                >
                  <Save className="me-1 size-4" />
                  {t("saveButton")}
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}