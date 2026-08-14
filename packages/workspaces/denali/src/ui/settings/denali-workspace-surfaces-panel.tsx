"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Checkbox } from "../adapters/platform-primitives";

import {
  buildDenaliWorkspaceSurfaceUiStatesMap,
  buildDenaliWorkspaceSurfacePatchInput,
  markDenaliWorkspaceSurfaceSaveError,
  markDenaliWorkspaceSurfaceSaveSuccess,
  markDenaliWorkspaceSurfaceSaving,
  mergeDenaliWorkspaceSurfaceUiStatesMap,
  patchDenaliWorkspaceSurfaceUiStatesMap,
  resolveDenaliOperatorSurfaceDisplayText,
  DENALI_WORKSPACE_SURFACES_TEST_IDS,
  type DenaliWorkspaceSurfaceEditorState,
  type DenaliWorkspaceSurfaceUiState,
} from "../../exposure/denali-workspace-surface-editor-state";
import { sortDenaliOperatorSettingsSurfaces } from "../../exposure/denali-exposure-surfaces";
import { localizeExposureCatalogFields } from "../adapters/localize-exposure-catalog-fields";
import type {
  DenaliSettingsExposureSurfaceDefinition,
  DenaliSettingsExposureSurfacesPanelProps,
} from "./settings-exposure-surfaces-ui-surface";

type SurfaceEditorState = DenaliWorkspaceSurfaceEditorState;
type SurfaceUiStateMap = Readonly<Record<string, DenaliWorkspaceSurfaceUiState>>;

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
  const tCommon = useTranslations("common");
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [surfaceStates, setSurfaceStates] = useState<SurfaceUiStateMap>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await io.loadSurfaces(workspaceId);
      setSurfaces(payload.surfaces);
      setSurfaceStates((current) =>
        Object.keys(current).length === 0
          ? buildDenaliWorkspaceSurfaceUiStatesMap(payload.surfaces)
          : mergeDenaliWorkspaceSurfaceUiStatesMap(current, payload.surfaces),
      );
    } catch {
      setLoadError(t("loadFailed"));
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
    setSurfaceStates((current) =>
      patchDenaliWorkspaceSurfaceUiStatesMap(current, surfaceKey, fallback, next),
    );
  }

  async function saveSurface(surfaceKey: string): Promise<void> {
    const surfaceState = surfaceStates[surfaceKey];
    if (surfaceState === undefined) {
      return;
    }
    setSurfaceStates((current) => markDenaliWorkspaceSurfaceSaving(current, surfaceKey));
    try {
      await io.saveSurfaceIntent(
        workspaceId,
        surfaceKey,
        buildDenaliWorkspaceSurfacePatchInput(surfaceState.editor),
      );
      setSurfaceStates((current) => markDenaliWorkspaceSurfaceSaveSuccess(current, surfaceKey));
    } catch {
      setSurfaceStates((current) =>
        markDenaliWorkspaceSurfaceSaveError(current, surfaceKey, t("saveFailed")),
      );
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

        {loadError !== null ? <p className="text-sm text-destructive">{loadError}</p> : null}

        {!loading && surfaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}

        {!loading
          ? orderedSurfaces.map((surface, surfaceIndex) => {
              const surfaceState = surfaceStates[surface.surface];
              if (surfaceState === undefined) {
                return null;
              }
              const state = surfaceState.editor;
              const effectiveIds = selection.resolveEffectiveSelectedFieldIds(
                state,
                catalogFieldIds,
              );
              const isSaving = surfaceState.saving;
              const isDirty = surfaceState.dirty;
              const surfaceError = surfaceState.error;
              return (
                <CollapsibleSection
                  key={surface.surface}
                  title={surfaceLabel(surface.surface)}
                  description={surfaceDescription(surface.surface)}
                  defaultOpen={surfaceIndex === 0}
                  badge={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={state.customizeFields ? "default" : "outline"}>
                        {state.customizeFields ? t("modeCustom") : t("modeInherit")}
                      </Badge>
                      {isDirty ? (
                        <Badge variant="outline">{tCommon("draftSync.dirty")}</Badge>
                      ) : null}
                    </div>
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
                              state,
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
                              state,
                              catalogFieldIds,
                              fieldId,
                              checked,
                            ),
                          )
                        }
                      />
                    ) : null}

                    {surfaceState.saved ? (
                      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
                        {t("saved")}
                      </p>
                    ) : null}

                    {surfaceError !== null ? (
                      <p className="text-sm text-destructive">{surfaceError}</p>
                    ) : null}

                    {canEdit ? (
                      <div className="flex justify-end border-t border-border/60 pt-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving || !isDirty}
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
