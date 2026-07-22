import { readWizardDraftFieldValueFromRegistry } from "@/bootstrap/workspace-wizard-draft-unification-bindings.generated";

import type { TourWizardDraft } from "./tour-wizard-draft";
import { getCanonicalValue } from "./tour-wizard-draft-path";

const STARTER_LEGACY_CANONICAL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  title: ["basics.title"],
  "basics.title": ["title"],
};

function hasDisplayableValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

/** Read canonical draft value with workspace legacy fallbacks (nested form paths, starter title bridge). */
export function readWizardDraftFieldValue(
  draft: TourWizardDraft,
  canonicalPath: string,
  pluginId?: string
): unknown {
  if (pluginId !== undefined) {
    const fromRegistry = readWizardDraftFieldValueFromRegistry(
      pluginId,
      draft as Record<string, unknown>,
      canonicalPath
    );
    if (fromRegistry !== null) {
      return fromRegistry;
    }
  }

  const primary = getCanonicalValue(draft, canonicalPath);
  if (hasDisplayableValue(primary)) {
    return primary;
  }

  for (const alias of STARTER_LEGACY_CANONICAL_ALIASES[canonicalPath] ?? []) {
    const alt = getCanonicalValue(draft, alias);
    if (hasDisplayableValue(alt)) {
      return alt;
    }
  }

  return primary;
}

/** String shown in wizard field controls (numbers stay digit strings). */
export function readWizardDraftFieldDisplayString(
  draft: TourWizardDraft,
  kind: string,
  canonicalPath: string,
  pluginId?: string
): string {
  const raw = readWizardDraftFieldValue(draft, canonicalPath, pluginId);
  if (kind === "number") {
    if (raw === undefined || raw === null) {
      return "";
    }
    return typeof raw === "number" ? String(raw) : String(raw);
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (raw === undefined || raw === null) {
    return "";
  }
  return String(raw);
}
