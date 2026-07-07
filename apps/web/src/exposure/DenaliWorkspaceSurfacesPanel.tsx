"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { ExposureCollapsibleSection } from "@/exposure/exposure-collapsible-section";
import { ExposureFieldChecklist } from "@/exposure/ExposureFieldChecklist";
import { localizeExposureCatalogFields } from "@/exposure/localize-exposure-catalog-fields";
import {
  catalogFieldIdsFromExposureFields,
  resolveEffectiveSelectedFieldIds,
  resolveExposureFieldSelectionFromPersisted,
  setExposureCustomizeFields,
  toExposureChecklistFields,
  toggleExposureFieldSelection,
  type ExposureCatalogField,
  type ExposureFieldSelectionState,
} from "@/exposure/exposure-field-selection";
import {
  fetchWorkspaceExposureSurfaces,
  patchWorkspaceSurfaceExposureIntent,
  type WorkspaceExposureSurfaceDefinition,
} from "@/exposure/workspace-exposure-surfaces-client";

export const DENALI_WORKSPACE_SURFACES_TEST_IDS = {
  panel: "denali-workspace-surfaces-panel",
  surface: "denali-workspace-surface",
} as const;

const SURFACE_DISPLAY_ORDER = ["public_list", "public_details", "user_dashboard", "reminder_feed"];

type SurfaceEditorState = ExposureFieldSelectionState & {
  readonly audience: string;
  readonly trigger: string;
};

type DenaliWorkspaceSurfacesPanelProps = {
  readonly workspaceId: string;
  readonly exposureCandidateFields: readonly ExposureCatalogField[];
  readonly canEdit: boolean;
};

function buildSurfaceState(surface: WorkspaceExposureSurfaceDefinition): SurfaceEditorState {
  const selection = resolveExposureFieldSelectionFromPersisted(
    surface.activeIntent?.mode === "override_fields",
    surface.activeIntent?.selectedFieldIds ?? [],
  );
  return {
    ...selection,
    audience: surface.audience,
    trigger: surface.trigger,
  };
}

export function DenaliWorkspaceSurfacesPanel({
  workspaceId,
  exposureCandidateFields,
  canEdit,
}: DenaliWorkspaceSurfacesPanelProps) {
  const t = useTranslations("settings.exposure.denaliSurfaces");
  const tChecklist = useTranslations("settings.exposure.fieldChecklist");
  const tWizard = useTranslations("denali");
  const catalogFieldIds = useMemo(
    () => catalogFieldIdsFromExposureFields(exposureCandidateFields),
    [exposureCandidateFields],
  );
  const checklistFields = useMemo(
    () => localizeExposureCatalogFields(toExposureChecklistFields(exposureCandidateFields), tWizard),
    [exposureCandidateFields, tWizard],
  );
  const [surfaces, setSurfaces] = useState<readonly WorkspaceExposureSurfaceDefinition[]>([]);
  const orderedSurfaces = useMemo(
    () =>
      [...surfaces].sort((left, right) => {
        const leftIndex = SURFACE_DISPLAY_ORDER.indexOf(left.surface);
        const rightIndex = SURFACE_DISPLAY_ORDER.indexOf(right.surface);
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }),
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
      const payload = await fetchWorkspaceExposureSurfaces(workspaceId);
      setSurfaces(payload.surfaces);
      const nextStates: Record<string, SurfaceEditorState> = {};
      for (const surface of payload.surfaces) {
        nextStates[surface.surface] = buildSurfaceState(surface);
      }
      setStates(nextStates);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function surfaceLabel(surface: string): string {
    const key = `surfaceNames.${surface}`;
    return t.has(key) ? t(key) : surface;
  }

  function surfaceDescription(surface: string): string {
    const key = `surfaceDescriptions.${surface}`;
    return t.has(key) ? t(key) : t("defaultSurfaceDescription");
  }

  function updateSurfaceState(
    surfaceKey: string,
    fallback: SurfaceEditorState,
    next: ExposureFieldSelectionState,
  ): void {
    setSavedSurface(null);
    setStates((current) => ({
      ...current,
      [surfaceKey]: { ...(current[surfaceKey] ?? fallback), ...next },
    }));
  }

  async function saveSurface(surfaceKey: string): Promise<void> {
    const state = states[surfaceKey];
    if (state === undefined) {
      return;
    }
    setSavingSurface(surfaceKey);
    setError(null);
    try {
      await patchWorkspaceSurfaceExposureIntent(workspaceId, surfaceKey, {
        audience: state.audience,
        trigger: state.trigger,
        enabled: state.customizeFields,
        selectedFieldIds: state.customizeFields ? [...state.selectedFieldIds] : [],
      });
      setSavedSurface(surfaceKey);
      await refresh();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSavingSurface(null);
    }
  }

  return (
    <Card data-denali-surface="card" className="shadow-sm" data-testid={DENALI_WORKSPACE_SURFACES_TEST_IDS.panel}>
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
              const effectiveIds = resolveEffectiveSelectedFieldIds(state, catalogFieldIds);
              const isSaving = savingSurface === surface.surface;
              return (
                <ExposureCollapsibleSection
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
                      <Badge variant="outline">{t("fieldCount", { count: effectiveIds.length })}</Badge>
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
                        onChange={(event) =>
                          updateSurfaceState(
                            surface.surface,
                            state,
                            setExposureCustomizeFields(
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
                      <ExposureFieldChecklist
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
                            toggleExposureFieldSelection(
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
                </ExposureCollapsibleSection>
              );
            })
          : null}
      </CardContent>
    </Card>
  );
}
