import { denaliDraftTombstoneBinding } from "./denali-draft-tombstone-binding";

export type DenaliDraftTombstoneShadowMode = "off" | "shadow" | "on";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractEnvelopeForm(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) {
    return null;
  }
  const form = data.form;
  if (!isRecord(form) || !isRecord(form.data)) {
    return null;
  }
  return form.data;
}

function readDeletedRoots(data: unknown): readonly string[] | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const meta = data.meta;
  if (!isRecord(meta)) {
    return undefined;
  }
  const roots = meta.deletedRoots;
  if (!Array.isArray(roots)) {
    return undefined;
  }
  return roots.filter((entry): entry is string => typeof entry === "string");
}

/** Dev-only shadow compare after PATCH 200 (Track C / deferred B-6). */
export function logDenaliTombstoneShadowMismatch(
  mode: DenaliDraftTombstoneShadowMode,
  baselineEnvelope: unknown,
  pushedEnvelope: unknown,
  serverEnvelope: unknown,
): void {
  if (mode !== "shadow") {
    return;
  }

  const baselineForm = extractEnvelopeForm(baselineEnvelope);
  const incomingForm = extractEnvelopeForm(pushedEnvelope);
  if (baselineForm === null || incomingForm === null) {
    return;
  }

  const hint = denaliDraftTombstoneBinding.resolveTombstoneRoots(baselineForm, incomingForm);
  const serverRoots = readDeletedRoots(serverEnvelope) ?? [];
  const hintKey = [...hint].sort().join(",");
  const serverKey = [...serverRoots].sort().join(",");
  if (hintKey !== serverKey) {
    console.warn("[draft-unification-v3] tombstone shadow mismatch", {
      clientHint: hint,
      serverDeletedRoots: serverRoots,
    });
  }
}
