import type { TourFormProfile, TourType } from "@repo/types";
import {
  DEFAULT_TOUR_FORM_PROFILE,
  defaultTourFormProfileForTourType,
  isTourFormProfile,
  normalizeTourFormProfileInput,
} from "@repo/types";

export type TourWizardPrefillMeta = {
  sourceTourId?: string;
  sourcePresetId?: string;
  themeIds?: { main?: string; secondary?: string[] };
  resolvedFormProfile: TourFormProfile;
  formProfileVersion: number;
  /** Wizard DTO strict-schema generation; see `tour-wizard-contract-version.ts`. */
  wizardContractVersion?: number;
  savedAt?: string;
};

export type ThemeRowForProfile = { id: string; formProfile?: TourFormProfile | string | null };

/** First non-empty theme id from RHF or native `<select>` (Playwright timing). */
export function coalesceWizardMainTourThemeId(input: {
  watchedMain?: string | undefined;
  storageMain?: string | undefined;
  domMain?: string | undefined;
}): string | undefined {
  for (const raw of [input.watchedMain, input.storageMain, input.domMain]) {
    if (typeof raw === "string" && raw.trim() !== "") {
      return raw.trim();
    }
  }
  return undefined;
}

/**
 * Theme/catalog/tourType profile resolver (pre–workspace-template authority).
 *
 * @deprecated Wizard create now resolves profile exclusively from
 * `workspace_tour_wizard_templates.base_profile` (`resolveWorkspaceTourFormProfileFromTemplate`
 * on web, `resolveWorkspaceTourFormProfile` on API). Retained for unit tests and the Edit tour
 * form (`resolveTourFormProfileForTourFormValues`).
 */
export function resolveTourFormProfile(input: {
  snapshot?: TourWizardPrefillMeta;
  mainTourThemeId: string | undefined;
  themeCatalog: ThemeRowForProfile[] | undefined;
  tourType: TourType | "" | undefined;
  /** When main theme id differs from snapshot.themeIds.main, snapshot is ignored for profile. */
  ignoreSnapshot?: boolean;
}): TourFormProfile {
  const mainId = input.mainTourThemeId?.trim();
  const snapMain = input.snapshot?.themeIds?.main?.trim();
  const useSnapshot =
    input.snapshot &&
    isTourFormProfile(input.snapshot.resolvedFormProfile) &&
    !input.ignoreSnapshot &&
    (!snapMain || !mainId || snapMain === mainId);

  if (useSnapshot && input.snapshot) {
    const snapProfile = normalizeTourFormProfileInput(input.snapshot.resolvedFormProfile);
    const themeBindingActive = Boolean(snapMain && mainId && snapMain === mainId);
    if (snapProfile === "general" && themeBindingActive && mainId && input.themeCatalog?.length) {
      const row = input.themeCatalog.find((t) => t.id === mainId);
      if (row?.formProfile != null) {
        const fromTheme = normalizeTourFormProfileInput(row.formProfile);
        if (fromTheme !== "general") {
          return fromTheme;
        }
      }
    }
    const tt = input.tourType;
    if (tt && typeof tt === "string" && tt.trim() !== "") {
      const fromTourType = defaultTourFormProfileForTourType(tt as TourType);
      // Snapshot `general` is a weak default (e.g. legacy drafts); explicit tour type should win.
      if (snapProfile === "general" && fromTourType !== "general") {
        return fromTourType;
      }
      // Stale snapshot label when the user has not bound the snapshot main theme (or changed it away).
      if (!themeBindingActive && fromTourType !== snapProfile) {
        return fromTourType;
      }
    }
    return snapProfile;
  }

  if (mainId && input.themeCatalog?.length) {
    const row = input.themeCatalog.find((t) => t.id === mainId);
    if (row?.formProfile != null) {
      return normalizeTourFormProfileInput(row.formProfile);
    }
  }

  const tt = input.tourType;
  if (tt && typeof tt === "string" && tt.trim() !== "") {
    return defaultTourFormProfileForTourType(tt as TourType);
  }

  return DEFAULT_TOUR_FORM_PROFILE;
}

/** Keep a non-general draft meta profile when a transient resolve pass still returns `general`. */
export function preserveWizardMetaResolvedProfile(
  next: TourFormProfile,
  prev: TourFormProfile | undefined,
): TourFormProfile {
  return next === "general" && prev && prev !== "general" ? prev : next;
}

/**
 * @deprecated Wizard UI uses `workspaceFormProfile` from the template query only.
 * Retained for unit tests documenting legacy coalesce behaviour.
 */
export function coalesceWizardResolvedProfile(input: {
  raw: TourFormProfile;
  snapshotProfile?: TourFormProfile;
  mainTourThemeId?: string;
  themeCatalog?: ThemeRowForProfile[];
  tourType?: TourType;
  persistedTourType?: TourType;
  /** Workspace wizard template default (e.g. denali → `mountain_outdoor`). */
  templateBaseProfile?: TourFormProfile;
}): TourFormProfile {
  let profile = preserveWizardMetaResolvedProfile(input.raw, input.snapshotProfile);
  if (profile !== "general") {
    return profile;
  }
  const mainId = input.mainTourThemeId?.trim();
  if (mainId && input.themeCatalog?.length) {
    const row = input.themeCatalog.find((t) => t.id === mainId);
    if (row?.formProfile != null) {
      const fromTheme = normalizeTourFormProfileInput(row.formProfile);
      if (fromTheme !== "general") {
        return fromTheme;
      }
    }
  }
  for (const tt of [input.tourType, input.persistedTourType]) {
    if (tt) {
      const fromTourType = defaultTourFormProfileForTourType(tt);
      if (fromTourType !== "general") {
        return fromTourType;
      }
    }
  }
  if (input.templateBaseProfile && input.templateBaseProfile !== "general") {
    return input.templateBaseProfile;
  }
  return profile;
}

/** Edit tour / flat `TourForm`: no clone snapshot; same theme + catalog rules as the wizard. */
export function resolveTourFormProfileForTourFormValues(input: {
  themeCatalog: ThemeRowForProfile[] | undefined;
  tourType: TourType | undefined;
  /** Primary theme id (first of `overview.tourThemeIds` on the flat form). */
  mainTourThemeId: string | undefined;
}): TourFormProfile {
  return resolveTourFormProfile({
    snapshot: undefined,
    ignoreSnapshot: true,
    mainTourThemeId: input.mainTourThemeId,
    themeCatalog: input.themeCatalog,
    tourType: input.tourType,
  });
}
