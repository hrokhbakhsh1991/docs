import { parseWizardTemplateResponse } from "@/features/settings/wizard-template-logic";
import type {
  WizardTemplateConfigResponse,
  WizardTemplateFieldRef,
} from "@/features/settings/wizard-template-types";

import { getCanonicalStringValue, setCanonicalStringValue } from "./tour-wizard-draft-path";
import type { TourWizardDraft } from "./tour-wizard-draft";

export const WIZARD_TEMPLATE_SEED_CANONICAL_PATH = "basics.title" as const;
export const WIZARD_TEMPLATE_SEED_CANONICAL_PATH_DENALI = "title" as const;

export const WIZARD_TEMPLATE_PREFILL_TEST_IDS = {
  seedPrefillField: "operator-wizard-template-seed-prefill",
  seedApplied: "operator-wizard-template-seed-applied",
} as const;

export function resolveWizardTemplateSeedCanonicalPath(pluginId: string): string {
  return pluginId === "denali"
    ? WIZARD_TEMPLATE_SEED_CANONICAL_PATH_DENALI
    : WIZARD_TEMPLATE_SEED_CANONICAL_PATH;
}

export function extractSeedLabelFromTemplateResponse(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const payloadRaw = record.payload;
  if (payloadRaw === null || typeof payloadRaw !== "object") {
    return "";
  }
  const inner = payloadRaw as Record<string, unknown>;
  return typeof inner.seedLabel === "string" ? inner.seedLabel.trim() : "";
}

export function parseWizardTemplateSeedForPrefill(payload: unknown): string {
  if (payload === null || typeof payload !== "object") {
    return "";
  }
  try {
    const parsed = parseWizardTemplateResponse(payload as WizardTemplateConfigResponse);
    return parsed.seedLabel.trim();
  } catch {
    return extractSeedLabelFromTemplateResponse(payload);
  }
}

export function applyWizardTemplateDefaultsToDraft(
  draft: TourWizardDraft,
  fieldOverlays: ReadonlyMap<string, WizardTemplateFieldRef>
): TourWizardDraft {
  let next = draft;
  for (const [canonicalPath, overlay] of fieldOverlays) {
    const defaultValue = overlay.defaultValue?.trim() ?? "";
    if (defaultValue.length === 0) {
      continue;
    }
    const current = getCanonicalStringValue(next, canonicalPath);
    if (current.trim().length > 0) {
      continue;
    }
    next = setCanonicalStringValue(next, canonicalPath, defaultValue);
  }
  return next;
}

export function applyWizardTemplateSeedToDraft(
  draft: TourWizardDraft,
  seedLabel: string,
  pluginId = "starter",
  options?: { readonly overlayDefaultValue?: string }
): TourWizardDraft {
  const trimmed = seedLabel.trim();
  if (trimmed.length === 0) {
    return draft;
  }
  const canonicalPath = resolveWizardTemplateSeedCanonicalPath(pluginId);
  const currentTitle = getCanonicalStringValue(draft, canonicalPath);
  const overlayDefault = options?.overlayDefaultValue?.trim() ?? "";
  if (
    currentTitle.trim().length > 0 &&
    currentTitle !== overlayDefault
  ) {
    return draft;
  }
  return setCanonicalStringValue(draft, canonicalPath, trimmed);
}

function applyDenaliPublishStatusDraftDefault(
  draft: TourWizardDraft,
  fieldOverlays: ReadonlyMap<string, WizardTemplateFieldRef>
): TourWizardDraft {
  if (!fieldOverlays.has("publishStatus")) {
    return draft;
  }
  const current = getCanonicalStringValue(draft, "publishStatus").trim();
  if (current.length > 0) {
    return draft;
  }
  return setCanonicalStringValue(draft, "publishStatus", "draft");
}

export function applyWizardTemplatePrefillToDraft(
  draft: TourWizardDraft,
  seedLabel: string,
  fieldOverlays: ReadonlyMap<string, WizardTemplateFieldRef>,
  pluginId: string
): TourWizardDraft {
  const withDefaults = applyWizardTemplateDefaultsToDraft(draft, fieldOverlays);
  const withPublishDefault =
    pluginId === "denali"
      ? applyDenaliPublishStatusDraftDefault(withDefaults, fieldOverlays)
      : withDefaults;
  const seedPath = resolveWizardTemplateSeedCanonicalPath(pluginId);
  const overlayDefault = fieldOverlays.get(seedPath)?.defaultValue;
  return applyWizardTemplateSeedToDraft(withPublishDefault, seedLabel, pluginId, {
    overlayDefaultValue: overlayDefault,
  });
}

export function shouldAttachSeedPrefillTestId(
  canonicalPath: string,
  pluginId?: string
): boolean {
  if (pluginId !== undefined) {
    return canonicalPath === resolveWizardTemplateSeedCanonicalPath(pluginId);
  }
  return (
    canonicalPath === WIZARD_TEMPLATE_SEED_CANONICAL_PATH ||
    canonicalPath === WIZARD_TEMPLATE_SEED_CANONICAL_PATH_DENALI
  );
}
