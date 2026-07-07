import { createCanonicalDocument, type CanonicalDocument } from "@app-tour/workspace-sdk";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";

const OBJECT_ROOTS = new Set([
  "review",
  "program",
  "transport",
  "pricing",
  "participants",
  "policies",
  "tripDetails",
  "photos",
  "gatheringPoints",
]);

function buildCanonicalDataShell(roots: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const root of roots) {
    if (root.startsWith("denali_") || OBJECT_ROOTS.has(root)) {
      data[root] = {};
      continue;
    }
    data[root] = null;
  }
  return data;
}

function mergeDraftIntoCanonicalShell(
  shell: Record<string, unknown>,
  draftData: Record<string, unknown>
): Record<string, unknown> {
  const merged = structuredClone(shell);
  for (const [key, value] of Object.entries(draftData)) {
    if (!(key in merged)) {
      continue;
    }
    if (Array.isArray(value)) {
      continue;
    }
    merged[key] = structuredClone(value);
  }
  return merged;
}

export function tourWizardDraftToCanonicalDocument(
  draft: DenaliTourWizardDraft,
  roots: readonly string[]
): CanonicalDocument {
  const shell = buildCanonicalDataShell(roots);
  const data = mergeDraftIntoCanonicalShell(shell, draft.data as Record<string, unknown>);
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: [...roots],
    data,
  });
}
