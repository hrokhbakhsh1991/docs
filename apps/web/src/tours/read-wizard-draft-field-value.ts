import type { WorkspacePlugin } from "@app-cloud/workspace-sdk";
import { resolveDraftShellCapability } from "@app-cloud/workspace-sdk";

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

/**
 * Read canonical draft value with workspace legacy fallbacks.
 * Phase 4am: prefer `capabilities.draftShell.readDraftFieldValue` when plugin in hand.
 */
export function readWizardDraftFieldValue(
  draft: TourWizardDraft,
  canonicalPath: string,
  plugin?: WorkspacePlugin
): unknown {
  if (plugin != null) {
    const fromCap = resolveDraftShellCapability(plugin)?.readDraftFieldValue;
    if (fromCap != null) {
      const value = fromCap(draft as Record<string, unknown>, canonicalPath);
      if (hasDisplayableValue(value)) {
        return value;
      }
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
  plugin?: WorkspacePlugin
): string {
  const raw = readWizardDraftFieldValue(draft, canonicalPath, plugin);
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
