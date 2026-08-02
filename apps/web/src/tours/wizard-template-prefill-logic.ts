import { parseWizardTemplateResponse } from "@/features/settings/wizard-template-logic";
import {
  resolveTemplateGateCapability,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";
import type {
  WizardTemplateConfigResponse,
  WizardTemplateFieldRef,
} from "@/features/settings/wizard-template-types";

import { getCanonicalStringValue, setCanonicalStringValue } from "./tour-wizard-draft-path";
import type { TourWizardDraft } from "./tour-wizard-draft";

export const WIZARD_TEMPLATE_SEED_CANONICAL_PATH = "basics.title" as const;
export const WIZARD_TEMPLATE_SEED_CANONICAL_PATH_TITLE = "title" as const;

export const WIZARD_TEMPLATE_PREFILL_TEST_IDS = {
  seedPrefillField: "operator-wizard-template-seed-prefill",
  seedApplied: "operator-wizard-template-seed-applied",
} as const;

export function resolveWizardTemplateSeedCanonicalPath(
  pluginId: string,
  plugin?: Pick<WorkspacePlugin, "fieldRegistry">
): string {
  if (plugin?.fieldRegistry.fields != null) {
    const paths = plugin.fieldRegistry.fields.map((field) => field.canonicalPath);
    if (paths.includes("title")) {
      return "title";
    }
    if (paths.includes(WIZARD_TEMPLATE_SEED_CANONICAL_PATH)) {
      return WIZARD_TEMPLATE_SEED_CANONICAL_PATH;
    }
    const dottedTitle = paths.find((path) => path.endsWith(".title"));
    if (dottedTitle != null) {
      return dottedTitle;
    }
  }
  void pluginId;
  return WIZARD_TEMPLATE_SEED_CANONICAL_PATH;
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
  fieldOverlays: ReadonlyMap<string, WizardTemplateFieldRef>,
  options?: { readonly preferTemplateDefaults?: boolean }
): TourWizardDraft {
  let next = draft;
  const preferTemplateDefaults = options?.preferTemplateDefaults === true;
  for (const [canonicalPath, overlay] of fieldOverlays) {
    const defaultValue = overlay.defaultValue?.trim() ?? "";
    if (defaultValue.length === 0) {
      continue;
    }
    const current = getCanonicalStringValue(next, canonicalPath);
    if (!preferTemplateDefaults && current.trim().length > 0) {
      continue;
    }
    next = setCanonicalStringValue(next, canonicalPath, defaultValue);
  }
  return next;
}

export function applyWizardTemplateSeedToDraft(
  draft: TourWizardDraft,
  seedLabel: string,
  pluginId: string,
  options?: {
    readonly overlayDefaultValue?: string;
    readonly plugin?: Pick<WorkspacePlugin, "fieldRegistry">;
  }
): TourWizardDraft {
  const trimmed = seedLabel.trim();
  if (trimmed.length === 0) {
    return draft;
  }
  const canonicalPath = resolveWizardTemplateSeedCanonicalPath(pluginId, options?.plugin);
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

function applyPublishStatusDraftDefault(
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
  pluginId: string,
  plugin?: Pick<WorkspacePlugin, "fieldRegistry" | "capabilities">
): TourWizardDraft {
  const withDefaults = applyWizardTemplateDefaultsToDraft(draft, fieldOverlays, {
    preferTemplateDefaults:
      resolveTemplateGateCapability(plugin ?? {})?.preferTemplateDefaultsOnPrefill === true,
  });
  const withPublishDefault = applyPublishStatusDraftDefault(withDefaults, fieldOverlays);
  const seedPath = resolveWizardTemplateSeedCanonicalPath(pluginId, plugin);
  const overlayDefault = fieldOverlays.get(seedPath)?.defaultValue;
  return applyWizardTemplateSeedToDraft(withPublishDefault, seedLabel, pluginId, {
    overlayDefaultValue: overlayDefault,
    plugin,
  });
}

export function shouldAttachSeedPrefillTestId(
  canonicalPath: string,
  pluginId?: string,
  plugin?: Pick<WorkspacePlugin, "fieldRegistry">
): boolean {
  if (pluginId !== undefined) {
    return canonicalPath === resolveWizardTemplateSeedCanonicalPath(pluginId, plugin);
  }
  return (
    canonicalPath === WIZARD_TEMPLATE_SEED_CANONICAL_PATH ||
    canonicalPath === WIZARD_TEMPLATE_SEED_CANONICAL_PATH_TITLE
  );
}
