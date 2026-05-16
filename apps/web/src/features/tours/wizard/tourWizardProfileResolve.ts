import type { TourFormProfile, TourType } from "@repo/types";
import {
  DEFAULT_TOUR_FORM_PROFILE,
  TOUR_FORM_PROFILE_VERSION,
  defaultTourFormProfileForTourType,
  isTourFormProfile,
  normalizeTourFormProfileInput,
} from "@repo/types";

import { TOUR_WIZARD_CONTRACT_VERSION } from "./contract/tour-wizard-contract-version";

export type TourWizardDraftMeta = {
  sourceTourId?: string;
  themeIds?: { main?: string; secondary?: string[] };
  resolvedFormProfile: TourFormProfile;
  formProfileVersion: number;
  /** Wizard DTO strict-schema generation; see `tour-wizard-contract-version.ts`. */
  wizardContractVersion?: number;
};

export function parseTourWizardDraftMeta(raw: unknown): TourWizardDraftMeta | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const w = o._wizardMeta;
  if (!w || typeof w !== "object" || Array.isArray(w)) return undefined;
  const m = w as Record<string, unknown>;
  const profileRaw = m.resolvedFormProfile;
  const profile = isTourFormProfile(profileRaw) ? profileRaw : DEFAULT_TOUR_FORM_PROFILE;
  const version = typeof m.formProfileVersion === "number" && Number.isFinite(m.formProfileVersion) ? m.formProfileVersion : TOUR_FORM_PROFILE_VERSION;
  const wizardContractVersion =
    typeof m.wizardContractVersion === "number" && Number.isFinite(m.wizardContractVersion)
      ? m.wizardContractVersion
      : TOUR_WIZARD_CONTRACT_VERSION;
  const sourceTourId = typeof m.sourceTourId === "string" ? m.sourceTourId : undefined;
  let themeIds: TourWizardDraftMeta["themeIds"];
  const ti = m.themeIds;
  if (ti && typeof ti === "object" && !Array.isArray(ti)) {
    const t = ti as Record<string, unknown>;
    const main = typeof t.main === "string" ? t.main : undefined;
    const sec = t.secondary;
    const secondary = Array.isArray(sec) ? sec.filter((x): x is string => typeof x === "string") : undefined;
    themeIds = { main, secondary };
  }
  return { sourceTourId, themeIds, resolvedFormProfile: profile, formProfileVersion: version, wizardContractVersion };
}

export type ThemeRowForProfile = { id: string; formProfile?: TourFormProfile | string | null };

/**
 * Resolves the active form profile for the wizard.
 * Prefer draft clone snapshot until the user changes the main theme away from the snapshot binding.
 */
export function resolveTourFormProfile(input: {
  snapshot?: TourWizardDraftMeta;
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
    const tt = input.tourType;
    if (tt && typeof tt === "string" && tt.trim() !== "") {
      const fromTourType = defaultTourFormProfileForTourType(tt as TourType);
      // Snapshot `general` is a weak default (e.g. legacy drafts); explicit tour type should win.
      if (snapProfile === "general" && fromTourType !== "general") {
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
