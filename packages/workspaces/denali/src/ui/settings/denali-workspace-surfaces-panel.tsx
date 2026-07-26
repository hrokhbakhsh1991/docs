"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Checkbox } from "../adapters/platform-primitives";

import {
  buildDenaliWorkspaceSurfaceEditorStatesMap,
  buildDenaliWorkspaceSurfacePatchInput,
  patchDenaliWorkspaceSurfaceEditorStatesMap,
  resolveDenaliOperatorSurfaceDisplayText,
  DENALI_WORKSPACE_SURFACES_TEST_IDS,
  type DenaliWorkspaceSurfaceEditorState,
} from "../../exposure/denali-workspace-surface-editor-state";
import { sortDenaliOperatorSettingsSurfaces } from "../../exposure/denali-exposure-surfaces";
import { localizeExposureCatalogFields } from "../adapters/localize-exposure-catalog-fields";
import type {
  DenaliSettingsExposureSurfaceDefinition,
  DenaliSettingsExposureSurfacesPanelProps,
} from "./settings-exposure-surfaces-ui-surface";

type SurfaceEditorState = DenaliWorkspaceSurfaceEditorState;

/**
 * Denali operator workspace-surfaces panel (H1.c.2.b).
 * BFF, shell layout/checklist chrome, and generic selection helpers are injected.
 */
export function DenaliWorkspaceSurfacesPanel({
  workspaceId,
  exposureCandidateFields,
  canEdit,
  io,
  chrome,
  selection,
}: DenaliSettingsExposureSurfacesPanelProps) {
  const {
    CollapsibleSection,
    FieldChecklist,
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Label,
    Skeleton,
  } = chrome;
  const t = useTranslations("settings.exposure.denaliSurfaces");
  const tChecklist = useTranslations("settings.exposure.fieldChecklist");
  const tWizard = useTranslations("denali");
  const catalogFieldIds = useMemo(
    () => selection.catalogFieldIdsFromExposureFields(exposureCandidateFields),
    [exposureCandidateFields, selection],
  );
  const checklistFields = useMemo(
    () =>
      localizeExposureCatalogFields(
        selection.toExposureChecklistFields(exposureCandidateFields),
        tWizard,
      ),
    [exposureCandidateFields, selection, tWizard],
  );
  const [surfaces, setSurfaces] = useState<readonly DenaliSettingsExposureSurfaceDefinition[]>(
    [],
  );
  const orderedSurfaces = useMemo(
    () => sortDenaliOperatorSettingsSurfaces(surfaces),
    [surfaces],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSurface, setSavingSurface] = useState<string | null>(null);
  const [savedSurface, setSavedSurface] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, SurfaceEditorState>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await io.loadSurfaces(workspaceId);
      setSurfaces(payload.surfaces);
      setStates(buildDenaliWorkspaceSurfaceEditorStatesMap(payload.surfaces));
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [io, t, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function surfaceLabel(surface: string): string {
    return resolveDenaliOperatorSurfaceDisplayText({
      kind: "name",
      surface,
      messages: { has: (key) => t.has(key), t: (key) => t(key) },
      fallback: surface,
    });
  }

  function surfaceDescription(surface: string): string {
    return resolveDenaliOperatorSurfaceDisplayText({
      kind: "description",
      surface,
      messages: { has: (key) => t.has(key), t: (key) => t(key) },
      fallback: t("defaultSurfaceDescription"),
    });
  }

  function updateSurfaceState(
    surfaceKey: string,
    fallback: SurfaceEditorState,
    next: { readonly customizeFields: boolean; readonly selectedFieldIds: readonly string[] },
  ): void {
    setSavedSurface(null);
    setStates((current) =>
      patchDenaliWorkspaceSurfaceEditorStatesMap(current, surfaceKey, fallback, next),
    );
  }

  async function saveSurface(surfaceKey: string): Promise<void> {
    const state = states[surfaceKey];
    if (state === undefined) {
      return;
    }
    setSavingSurface(surfaceKey);
    setError(null);
    try {
      await io.saveSurfaceIntent(
        workspaceId,
        surfaceKey,
        buildDenaliWorkspaceSurfacePatchInput(state),
      );
      setSavedSurface(surfaceKey);
      await refresh();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSavingSurface(null);
    }
  }

  return (
    <Card
      data-operator-surface="card"
      className="shadow-sm"
      data-testid={DENALI_WORKSPACE_SURFACES_TEST_IDS.panel}
    >
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <p className="text-xs leading-5 text-muted-foreground">{t("companionNotice")}</p>

        {loading ? <Skeleton className="h-40 w-full rounded-lg" /> : null}

        {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && surfaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}

        {!loading
          ? orderedSurfaces.map((surface, surfaceIndex) => {
              const state = states[surface.surface];
              if (state === undefined) {
                return null;
              }
              const effectiveIds = selection.resolveEffectiveSelectedFieldIds(
                state,
                catalogFieldIds,
              );
              const isSaving = savingSurface === surface.surface;
              return (
                <CollapsibleSection
                  key={surface.surface}
                  title={surfaceLabel(surface.surface)}
                  description={surfaceDescription(surface.surface)}
                  defaultOpen={surfaceIndex === 0}
                  badge={
                    <Badge variant={state.customizeFields ? "default" : "outline"}>
                      {state.customizeFields ? t("modeCustom") : t("modeInherit")}
                    </Badge>
                  }
                  className="shadow-none"
                >
                  <div
                    className="space-y-4"
                    data-testid={DENALI_WORKSPACE_SURFACES_TEST_IDS.surface}
                    data-surface={surface.surface}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">
                        {t("fieldCount", { count: effectiveIds.length })}
                      </Badge>
                    </div>

                    <label
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-3 text-sm"
                      htmlFor={`denali-surface-customize-${surface.surface}`}
                    >
                      <Checkbox
                        id={`denali-surface-customize-${surface.surface}`}
                        className="mt-0.5"
                        checked={state.customizeFields}
                        disabled={!canEdit || isSaving}
                        onChange={(event: { readonly target: { readonly checked: boolean } }) =>
                          updateSurfaceState(
                            surface.surface,
                            state,
                            selection.setExposureCustomizeFields(
                              states[surface.surface] ?? state,
                              catalogFieldIds,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                      <span className="leading-5">
                        <Label htmlFor={`denali-surface-customize-${surface.surface}`}>
                          {t("customizeFields")}
                        </Label>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {state.customizeFields ? t("customizeHint") : t("inheritHint")}
                        </span>
                      </span>
                    </label>

                    {state.customizeFields ? (
                      <FieldChecklist
                        context={{
                          surface: surface.surface,
                          audience: surface.audience,
                          trigger: surface.trigger,
                        }}
                        fields={checklistFields}
                        selectedFieldIds={effectiveIds}
                        disabled={!canEdit || isSaving}
                        emptyLabel={t("emptyFields")}
                        selectedSummary={t("selectedSummary", { count: effectiveIds.length })}
                        labels={{
                          searchPlaceholder: tChecklist("searchPlaceholder"),
                          selectAllInGroup: tChecklist("selectAllInGroup"),
                          clearGroup: tChecklist("clearGroup"),
                          selectedOfTotal: tChecklist("selectedOfTotal", {
                            selected: effectiveIds.length,
                            total: checklistFields.length,
                          }),
                        }}
                        onFieldToggle={(fieldId, checked) =>
                          updateSurfaceState(
                            surface.surface,
                            state,
                            selection.toggleExposureFieldSelection(
                              states[surface.surface] ?? state,
                              catalogFieldIds,
                              fieldId,
                              checked,
                            ),
                          )
                        }
                      />
                    ) : null}

                    {savedSurface === surface.surface ? (
                      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
                        {t("saved")}
                      </p>
                    ) : null}

                    {canEdit ? (
                      <div className="flex justify-end border-t border-border/60 pt-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => void saveSurface(surface.surface)}
                        >
                          {isSaving ? t("saving") : t("save")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CollapsibleSection>
              );
            })
          : null}
      </CardContent>
    </Card>
  );
}
