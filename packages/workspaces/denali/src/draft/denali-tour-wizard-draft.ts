import {
  getCanonicalStringFromDraft,
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
  type CanonicalWizardDraftEnvelope,
} from "../wizard/canonical-draft-access";
import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "../adapters/denaliCanonicalBasicsControl";
import type {
  DenaliEventVariant,
  DenaliTourCategory,
  DenaliTourDuration,
} from "../types/legacy/denali-canonical-basics";
import type { DenaliTourKind } from "../types/legacy/repo-types";

/** Denali operator wizard draft — canonical `data` bag (workspace-owned; not shell `TourWizardDraft`). */
export type DenaliTourWizardDraft = CanonicalWizardDraftEnvelope;

function readStoredTourKindSlug(draft: DenaliTourWizardDraft): string {
  const direct = getCanonicalStringFromDraft(draft, "category").trim();
  if (readDenaliCanonicalBasics(direct as DenaliTourKind | undefined) != null) {
    return direct;
  }

  const legacy = getCanonicalStringFromDraft(draft, "basicInfo.tourType").trim();
  if (readDenaliCanonicalBasics(legacy as DenaliTourKind | undefined) != null) {
    return legacy;
  }

  return direct.length > 0 ? direct : legacy;
}

function writeTourKindSlug(
  draft: DenaliTourWizardDraft,
  tourKind: string | undefined
): DenaliTourWizardDraft {
  return setCanonicalValueOnDraft(draft, "category", tourKind);
}

function patchTourKindAlias(
  draft: DenaliTourWizardDraft,
  patch: {
    readonly category?: DenaliTourCategory;
    readonly duration?: DenaliTourDuration;
    readonly eventVariant?: DenaliEventVariant;
  }
): DenaliTourWizardDraft {
  const currentTourKind = readStoredTourKindSlug(draft);
  const nextTourKind = patchDenaliCanonicalBasics(
    currentTourKind.length > 0 ? (currentTourKind as DenaliTourKind) : undefined,
    patch
  );
  return writeTourKindSlug(draft, nextTourKind);
}

export function emptyDenaliTourWizardDraft(): DenaliTourWizardDraft {
  return { data: {} };
}

export function getCanonicalStringValue(
  draft: DenaliTourWizardDraft,
  canonicalPath: string
): string {
  if (canonicalPath === "category") {
    return readStoredTourKindSlug(draft);
  }
  if (canonicalPath === "duration") {
    return readDenaliCanonicalBasics(readStoredTourKindSlug(draft) as DenaliTourKind | undefined)
      ?.duration ?? "";
  }
  if (canonicalPath === "eventVariant") {
    return readDenaliCanonicalBasics(readStoredTourKindSlug(draft) as DenaliTourKind | undefined)
      ?.eventVariant ?? "";
  }
  return getCanonicalStringFromDraft(draft, canonicalPath);
}

export function getCanonicalValue(draft: DenaliTourWizardDraft, canonicalPath: string): unknown {
  if (canonicalPath === "category") {
    const tourKind = readStoredTourKindSlug(draft);
    return tourKind.length > 0 ? tourKind : undefined;
  }
  if (canonicalPath === "duration") {
    return (
      readDenaliCanonicalBasics(readStoredTourKindSlug(draft) as DenaliTourKind | undefined)
        ?.duration ?? undefined
    );
  }
  if (canonicalPath === "eventVariant") {
    return (
      readDenaliCanonicalBasics(readStoredTourKindSlug(draft) as DenaliTourKind | undefined)
        ?.eventVariant ?? undefined
    );
  }
  return getCanonicalValueFromDraft(draft, canonicalPath);
}

export function setCanonicalStringValue(
  draft: DenaliTourWizardDraft,
  canonicalPath: string,
  value: string
): DenaliTourWizardDraft {
  if (canonicalPath === "category") {
    if (readDenaliCanonicalBasics(value as DenaliTourKind | undefined) != null) {
      return writeTourKindSlug(draft, value);
    }
    return patchTourKindAlias(draft, { category: value as DenaliTourCategory });
  }
  if (canonicalPath === "duration") {
    return patchTourKindAlias(draft, { duration: value as DenaliTourDuration });
  }
  if (canonicalPath === "eventVariant") {
    return patchTourKindAlias(draft, { eventVariant: value as DenaliEventVariant });
  }
  return setCanonicalValueOnDraft(draft, canonicalPath, value);
}

export function setCanonicalValue(
  draft: DenaliTourWizardDraft,
  canonicalPath: string,
  value: unknown
): DenaliTourWizardDraft {
  if (typeof value === "string") {
    return setCanonicalStringValue(draft, canonicalPath, value);
  }
  if (canonicalPath === "category" && value === undefined) {
    return writeTourKindSlug(draft, undefined);
  }
  return setCanonicalValueOnDraft(draft, canonicalPath, value);
}
