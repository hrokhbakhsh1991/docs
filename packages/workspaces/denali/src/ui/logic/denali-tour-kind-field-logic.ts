import {
  readDenaliCanonicalBasics,
  type DenaliCanonicalBasicsSelection,
} from "../../adapters/denaliCanonicalBasicsControl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";

import { denaliCategoryRequiresEventVariant } from "./denali-tour-kind-labels";

export type DenaliTourKindUiBasics = DenaliCanonicalBasicsSelection;

/** Apply tour-kind slug onto a draft envelope (category is the sole persisted anchor). */
export function rebaseCategoryDraftChange(
  draft: DenaliTourWizardDraft,
  nextSlug: string
): DenaliTourWizardDraft {
  return setCanonicalStringValue(draft, "category", nextSlug);
}

/** Re-apply category slug from a possibly stale draft onto the latest engine snapshot. */
export function rebaseCategoryDraftChangeOntoLatest(
  latest: DenaliTourWizardDraft,
  incoming: DenaliTourWizardDraft
): DenaliTourWizardDraft {
  const nextCategory = getCanonicalStringValue(incoming, "category");
  const latestCategory = getCanonicalStringValue(latest, "category");
  if (nextCategory === latestCategory) {
    return mergeIncomingDraftDiffOntoLatest(latest, incoming);
  }
  return setCanonicalStringValue(latest, "category", nextCategory);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeIncomingDraftDiffOntoLatest(
  latest: DenaliTourWizardDraft,
  incoming: DenaliTourWizardDraft
): DenaliTourWizardDraft {
  const latestData = (latest.data ?? {}) as Record<string, unknown>;
  const incomingData = (incoming.data ?? {}) as Record<string, unknown>;
  const merged = mergeIncomingNodeDiffOntoLatest(latestData, incomingData);
  return { data: merged as DenaliTourWizardDraft["data"] };
}

function mergeIncomingNodeDiffOntoLatest(
  latestNode: Record<string, unknown>,
  incomingNode: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...latestNode };
  for (const key of Object.keys(incomingNode)) {
    const incomingValue = incomingNode[key];
    const latestValue = latestNode[key];
    if (JSON.stringify(incomingValue) === JSON.stringify(latestValue)) {
      continue;
    }
    if (isRecord(incomingValue) && isRecord(latestValue)) {
      result[key] = mergeIncomingNodeDiffOntoLatest(latestValue, incomingValue);
      continue;
    }
    result[key] = incomingValue;
  }
  return result;
}

/** Re-apply user edits from a possibly stale draft onto the latest engine snapshot. */
export function rebaseDraftChangeOntoLatest(
  latest: DenaliTourWizardDraft,
  incoming: DenaliTourWizardDraft
): DenaliTourWizardDraft {
  const nextCategory = getCanonicalStringValue(incoming, "category");
  const latestCategory = getCanonicalStringValue(latest, "category");
  if (nextCategory !== latestCategory) {
    return setCanonicalStringValue(latest, "category", nextCategory);
  }
  return mergeIncomingDraftDiffOntoLatest(latest, incoming);
}

/** UI must not treat matrix fallback dimensions as a persisted tour kind selection. */
export function resolveDenaliTourKindUiBasics(tourKindSlug: string): {
  readonly hasSelection: boolean;
  readonly basics: DenaliTourKindUiBasics | null;
} {
  const trimmed = tourKindSlug.trim();
  if (trimmed.length === 0) {
    return { hasSelection: false, basics: null };
  }
  return {
    hasSelection: true,
    basics:
      readDenaliCanonicalBasics(trimmed as Parameters<typeof readDenaliCanonicalBasics>[0]) ?? null,
  };
}

export function isDenaliTourKindChoiceActive(
  hasSelection: boolean,
  currentValue: string | undefined,
  choiceValue: string
): boolean {
  return hasSelection && currentValue === choiceValue;
}

/** @deprecated Collapsible picker removed — matrix stays visible; use summary banner only. */
export function resolveDenaliTourKindPickerOpen(_hasSelection: boolean): boolean {
  return true;
}

export function isDenaliTourKindSelectionComplete(
  hasSelection: boolean,
  basics: DenaliTourKindUiBasics | null
): boolean {
  if (!hasSelection || basics == null) {
    return false;
  }
  if (denaliCategoryRequiresEventVariant(basics.category)) {
    return basics.eventVariant != null;
  }
  return true;
}

/** i18n key segments for summary line (category · duration · eventVariant). */
export function resolveDenaliTourKindSummaryParts(
  basics: DenaliTourKindUiBasics | null
): readonly ("category" | "duration" | "eventVariant")[] {
  if (basics == null) {
    return [];
  }
  const parts: Array<"category" | "duration" | "eventVariant"> = ["category", "duration"];
  if (basics.eventVariant != null) {
    parts.push("eventVariant");
  }
  return parts;
}
