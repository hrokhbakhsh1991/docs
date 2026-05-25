import type { TourWizardDraftRecord } from "@/lib/tour-wizard-draft.client";

import {
  parseDenaliWizardDraftEnvelope,
  type ParsedDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";

import { resolveDenaliWizardDraftHydration } from "./safeDraftHydration";

export type DenaliWizardDraftRestorePick = {
  parsed: ParsedDenaliWizardDraft;
  source: "local" | "server";
  serverVersion?: number;
  currentStepIndex?: number;
};

function draftUpdatedAtMs(parsed: ParsedDenaliWizardDraft | null): number {
  const raw = parsed?.wizardMeta?.savedAt;
  if (typeof raw !== "string" || !raw.trim()) {
    return 0;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function isDenaliDraftStructurallyCompatible(parsed: ParsedDenaliWizardDraft | null): boolean {
  if (parsed == null) {
    return false;
  }
  return resolveDenaliWizardDraftHydration(parsed).status === "compatible";
}

function parseServerDenaliDraft(
  server: TourWizardDraftRecord | null | undefined,
): ParsedDenaliWizardDraft | null {
  if (server?.payload == null || typeof server.payload !== "object") {
    return null;
  }
  return parseDenaliWizardDraftEnvelope(server.payload);
}

/**
 * Chooses local vs workspace-server Denali draft for restore.
 * Server wins only when newer by timestamp and structurally compatible (version hash).
 * Never overwrites a compatible local draft with an incompatible server payload.
 */
export function pickDenaliWizardDraftForRestore(
  local: ParsedDenaliWizardDraft | null,
  server: TourWizardDraftRecord | null | undefined,
): DenaliWizardDraftRestorePick | null {
  const serverParsed = parseServerDenaliDraft(server);

  if (local == null && serverParsed == null) {
    return null;
  }

  if (local == null && serverParsed != null) {
    if (!isDenaliDraftStructurallyCompatible(serverParsed)) {
      return null;
    }
    return {
      parsed: serverParsed,
      source: "server",
      serverVersion: server?.version,
      currentStepIndex: server?.currentStepIndex,
    };
  }

  if (local != null && serverParsed == null) {
    return { parsed: local, source: "local" };
  }

  if (local == null || serverParsed == null) {
    return null;
  }

  const localCompatible = isDenaliDraftStructurallyCompatible(local);
  const serverCompatible = isDenaliDraftStructurallyCompatible(serverParsed);

  if (!serverCompatible && localCompatible) {
    return { parsed: local, source: "local", serverVersion: server?.version };
  }

  if (serverCompatible && !localCompatible) {
    return {
      parsed: serverParsed,
      source: "server",
      serverVersion: server!.version,
      currentStepIndex: server!.currentStepIndex,
    };
  }

  if (!serverCompatible && !localCompatible) {
    const serverMs = Date.parse(server!.updatedAt);
    const localMs = draftUpdatedAtMs(local);
    if (Number.isFinite(serverMs) && serverMs > localMs) {
      return {
        parsed: serverParsed,
        source: "server",
        serverVersion: server!.version,
        currentStepIndex: server!.currentStepIndex,
      };
    }
    return { parsed: local, source: "local", serverVersion: server?.version };
  }

  const serverMs = Date.parse(server!.updatedAt);
  const localMs = draftUpdatedAtMs(local);
  if (Number.isFinite(serverMs) && serverMs > localMs) {
    return {
      parsed: serverParsed,
      source: "server",
      serverVersion: server!.version,
      currentStepIndex: server!.currentStepIndex,
    };
  }

  return { parsed: local, source: "local", serverVersion: server?.version };
}
