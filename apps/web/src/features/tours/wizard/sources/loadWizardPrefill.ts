import {
  TOUR_FORM_PROFILE_VERSION,
  normalizeTourFormProfileInput,
  type TourFormProfile,
} from "@repo/types";
import { getTourWorkspaceDefinition } from "@repo/shared-contracts";

import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { applyTourWizardPatch } from "@/features/tours/wizard/applyTourWizardPatch";
import {
  mergeDenaliWizardDefaults,
  serializeDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { mapWizardPrefillToFormPatch } from "@/features/tours/wizard/profiles/mapWizardPrefillToFormPatch";
import {
  applyClassicWizardPreset,
  applyDenaliWizardPreset,
} from "@/features/tours/wizard/tourCreationPresetApply";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { serializeWizardDraft } from "@/features/tours/wizard/tourWizardDraftEnvelope";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import { getTourPresetById } from "@/lib/settings-tour-presets.client";
import { getTourThemes } from "@/lib/settings-tour-themes.client";

import type {
  LoadWizardPrefillContext,
  TourPresetForPrefill,
  WizardPrefillQuery,
  WizardPrefillResult,
} from "./types";

import { fetchWorkspaceTourWizardTemplate } from "@/lib/settings-tour-wizard-template.client";

const THEME_CATALOG_TIMEOUT_MS = 8_000;

function defaultFetchTour(tourId: string, signal?: AbortSignal): Promise<unknown> {
  return fetch(`/api/tours/${encodeURIComponent(tourId)}`, {
    method: "GET",
    credentials: "include",
    signal,
    headers: { "Content-Type": "application/json" },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? "تور برای کپی‌کردن یافت نشد"
          : `خطا در بارگذاری تور: ${response.status}`,
      );
    }
    return response.json();
  });
}

function defaultFetchPreset(presetId: string): Promise<TourPresetForPrefill> {
  return getTourPresetById(presetId);
}

async function defaultFetchThemes(signal?: AbortSignal): Promise<Awaited<ReturnType<typeof getTourThemes>>> {
  return Promise.race([
    getTourThemes(),
    new Promise<never>((_, reject) => {
      const id = window.setTimeout(() => reject(new Error("theme catalog timeout")), THEME_CATALOG_TIMEOUT_MS);
      signal?.addEventListener("abort", () => window.clearTimeout(id), { once: true });
    }),
  ]);
}

function defaultFetchWizardTemplate() {
  // Pass signal to fetchWorkspaceTourWizardTemplate if it supported it, but it currently does not.
  // We can just call it.
  return fetchWorkspaceTourWizardTemplate();
}

function resolveUseDenaliRail(formProfile: TourFormProfile | string | null | undefined): boolean {
  const ws = getTourWorkspaceDefinition(formProfile as TourFormProfile);
  return ws?.ui.wizardMode === "denali";
}

async function loadClonePrefill(
  cloneTourId: string,
  ctx: LoadWizardPrefillContext,
): Promise<WizardPrefillResult> {
  const fetchTour = ctx.fetchTour ?? defaultFetchTour;
  const fetchWizardTemplate = ctx.fetchWizardTemplate ?? defaultFetchWizardTemplate;
  
  const [tour, templateEnv] = await Promise.all([
    fetchTour(cloneTourId, ctx.signal) as Promise<TourCloneSourceDto>,
    fetchWizardTemplate(ctx.signal),
  ]);

  const formProfile = resolveWorkspaceTourFormProfileFromTemplate(templateEnv);
  const useDenaliRail = resolveUseDenaliRail(formProfile);

  if (useDenaliRail) {
    const denaliPatch = mapWizardPrefillToFormPatch(formProfile, {
      kind: "clone",
      tour,
    }) as Partial<DenaliCreateTourWizardForm>;
    const mergedClone = mergeDenaliWizardDefaults(
      buildDenaliTourCreateDefaultValues(),
      denaliPatch,
    );
    const resolvedProfile = normalizeTourFormProfileInput(formProfile);
    const wizardMeta: TourWizardDraftMeta = {
      sourceTourId: cloneTourId,
      resolvedFormProfile: resolvedProfile,
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      savedAt: new Date().toISOString(),
      themeIds:
        (mergedClone.programNature?.themeIds?.length ?? 0) > 0
          ? { main: mergedClone.programNature!.themeIds![0] }
          : undefined,
    };
    return {
      rail: "denali",
      serializedDraft: serializeDenaliWizardDraft(mergedClone, wizardMeta),
    };
  }

  const wizardData = mapWizardPrefillToFormPatch(formProfile, {
    kind: "clone",
    tour,
  }) as Partial<TourCreateFormValues>;
  let themes: Awaited<ReturnType<typeof getTourThemes>> = [];
  try {
    const fetchThemes = ctx.fetchThemes ?? defaultFetchThemes;
    themes = await fetchThemes(ctx.signal);
  } catch {
    // Theme catalog is optional for clone.
  }

  const { filteredPatch } = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: wizardData,
    currentProfile: formProfile,
    themeCatalog: themes,
    tourType: wizardData.overview?.tourType,
    tenantFormContract: ctx.tenantFormContract,
  });

  const mainThemeId = wizardData.overview?.mainTourThemeId?.trim();
  const secondaries = wizardData.overview?.secondaryTourThemeIds ?? [];
  const wizardMeta: TourWizardDraftMeta = {
    sourceTourId: cloneTourId,
    themeIds: {
      main: mainThemeId || undefined,
      secondary: secondaries.length > 0 ? secondaries : undefined,
    },
    resolvedFormProfile: normalizeTourFormProfileInput(formProfile),
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };

  return {
    rail: "classic",
    serializedDraft: serializeWizardDraft(filteredPatch ?? wizardData, wizardMeta),
  };
}

async function loadPresetPrefill(
  presetId: string,
  ctx: LoadWizardPrefillContext,
): Promise<WizardPrefillResult> {
  const fetchPreset = ctx.fetchPreset ?? defaultFetchPreset;
  const fetchWizardTemplate = ctx.fetchWizardTemplate ?? defaultFetchWizardTemplate;

  const [preset, templateEnv] = await Promise.all([
    fetchPreset(presetId, ctx.signal),
    fetchWizardTemplate(ctx.signal),
  ]);

  const formProfile = resolveWorkspaceTourFormProfileFromTemplate(templateEnv);
  const useDenaliRail = resolveUseDenaliRail(formProfile);
  const presetCtx = {
    matchTourType: preset.matchTourType,
    matchMainTourThemeId: preset.matchMainTourThemeId,
  };
  const resolvedProfile = normalizeTourFormProfileInput(formProfile);

  if (useDenaliRail) {
    const merged = applyDenaliWizardPreset({
      workspaceFormProfile: resolvedProfile,
      defaults: preset.defaults ?? {},
      ctx: presetCtx,
      baseValues: buildDenaliTourCreateDefaultValues(),
    });
    const wizardMeta: TourWizardDraftMeta = {
      sourcePresetId: presetId,
      resolvedFormProfile: resolvedProfile,
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      savedAt: new Date().toISOString(),
      themeIds:
        (merged.programNature?.themeIds?.length ?? 0) > 0
          ? { main: merged.programNature!.themeIds![0] }
          : undefined,
    };
    return {
      rail: "denali",
      serializedDraft: serializeDenaliWizardDraft(merged, wizardMeta),
    };
  }

  let themes: Awaited<ReturnType<typeof getTourThemes>> = [];
  try {
    const fetchThemes = ctx.fetchThemes ?? defaultFetchThemes;
    themes = await fetchThemes(ctx.signal);
  } catch {
    /* optional */
  }

  const mergedValues = applyClassicWizardPreset({
    workspaceFormProfile: resolvedProfile,
    defaults: preset.defaults ?? {},
    ctx: presetCtx,
    baseValues: buildTourCreateFormDefaultValues(),
    themeCatalog: themes,
    tenantFormContract: ctx.tenantFormContract,
  });

  const mainThemeId = mergedValues.overview?.mainTourThemeId?.trim();
  const secondaries = mergedValues.overview?.secondaryTourThemeIds ?? [];
  const wizardMeta: TourWizardDraftMeta = {
    sourcePresetId: presetId,
    resolvedFormProfile: resolvedProfile,
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: {
      main: mainThemeId || undefined,
      secondary: secondaries.length > 0 ? secondaries : undefined,
    },
  };

  return {
    rail: "classic",
    serializedDraft: serializeWizardDraft(mergedValues, wizardMeta),
  };
}

/**
 * Loads preset/clone bootstrap payload for `/tours/new` (map-phase F1.8).
 * Returns `null` for blank (no LS write needed).
 */
export async function loadWizardPrefill(
  source: WizardPrefillQuery,
  ctx: LoadWizardPrefillContext,
): Promise<WizardPrefillResult | null> {
  if (source.kind === "blank") {
    return null;
  }
  if (source.kind === "clone") {
    return loadClonePrefill(source.cloneTourId, ctx);
  }
  return loadPresetPrefill(source.presetId, ctx);
}
