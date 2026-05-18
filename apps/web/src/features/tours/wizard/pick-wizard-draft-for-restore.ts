import type { WorkspaceTourWizardDraftRecord } from "@/lib/settings-tour-wizard-draft.client";

import { parseWizardDraftRecord, type ParsedWizardDraft } from "./tourWizardDraftEnvelope";

export type WizardDraftRestorePick = {
  parsed: ParsedWizardDraft;
  source: "local" | "server";
  rowVersion?: number;
};

function draftUpdatedAtMs(parsed: ParsedWizardDraft | null): number {
  const raw = parsed?.wizardMeta?.savedAt;
  if (typeof raw !== "string" || !raw.trim()) {
    return 0;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function envelopeToParsedWizardDraft(
  envelope: Record<string, unknown>,
): ParsedWizardDraft | null {
  return parseWizardDraftRecord(JSON.stringify(envelope));
}

/**
 * Chooses local vs server draft for restore. Server wins when newer by `updatedAt` / `savedAt`.
 */
export function pickWizardDraftForRestore(
  local: ParsedWizardDraft | null,
  server: WorkspaceTourWizardDraftRecord | null,
): WizardDraftRestorePick | null {
  if (!local && !server) {
    return null;
  }
  if (!local && server) {
    const parsed = envelopeToParsedWizardDraft(server.envelope);
    if (!parsed) {
      return null;
    }
    return { parsed, source: "server", rowVersion: server.rowVersion };
  }
  if (local && !server) {
    return { parsed: local, source: "local" };
  }
  if (!local || !server) {
    return null;
  }
  const serverParsed = envelopeToParsedWizardDraft(server.envelope);
  if (!serverParsed) {
    return { parsed: local, source: "local" };
  }
  const serverMs = Date.parse(server.updatedAt);
  const localMs = draftUpdatedAtMs(local);
  const serverProfile = serverParsed.wizardMeta?.resolvedFormProfile;
  const localProfile = local.wizardMeta?.resolvedFormProfile;
  const serverLooksLikeEmptyDefault = serverProfile === "general" || serverProfile == null;
  const localHasExplicitProfile = Boolean(localProfile && localProfile !== "general");
  if (localHasExplicitProfile && serverLooksLikeEmptyDefault) {
    return { parsed: local, source: "local", rowVersion: server.rowVersion };
  }
  if (Number.isFinite(serverMs) && serverMs > localMs) {
    return { parsed: serverParsed, source: "server", rowVersion: server.rowVersion };
  }
  return { parsed: local, source: "local", rowVersion: server.rowVersion };
}
