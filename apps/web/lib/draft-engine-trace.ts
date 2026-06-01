/**
 * In-memory ring buffer for draft-engine PATCH / wizard draft sync diagnostics.
 * Enable in dev: `localStorage.setItem('draftEngineTrace', '1')` or `?draftTrace=1`.
 */

export type DraftEngineTraceKind =
  | "wizard_watch_debounced"
  | "wizard_set_draft_user"
  | "wizard_set_draft_step"
  | "adapter_on_push_start"
  | "patch_start"
  | "patch_success"
  | "patch_409";

export type DraftEngineTraceEntry = {
  seq: number;
  at: string;
  atMs: number;
  kind: DraftEngineTraceKind;
  detail: string;
  meta?: Record<string, unknown>;
};

const MAX_ENTRIES = 200;
const buffer: DraftEngineTraceEntry[] = [];
let seq = 0;

export function isDraftEngineTraceEnabled(): boolean {
  if (typeof window === "undefined") {
    return process.env.DRAFT_ENGINE_TRACE === "1";
  }
  try {
    if (window.location.search.includes("draftTrace=1")) {
      return true;
    }
    return window.localStorage.getItem("draftEngineTrace") === "1";
  } catch {
    return false;
  }
}

export function appendDraftEngineTrace(
  kind: DraftEngineTraceKind,
  detail: string,
  meta?: Record<string, unknown>,
): void {
  if (!isDraftEngineTraceEnabled()) {
    return;
  }
  seq += 1;
  const atMs = Date.now();
  const entry: DraftEngineTraceEntry = {
    seq,
    at: new Date(atMs).toISOString(),
    atMs,
    kind,
    detail,
    ...(meta != null ? { meta } : {}),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
  // eslint-disable-next-line no-console
  console.log(`[draft-engine-trace #${entry.seq}] ${kind} ${detail}`, meta ?? "");
}

export function getDraftEngineTraceSnapshot(): readonly DraftEngineTraceEntry[] {
  return [...buffer];
}

export function clearDraftEngineTrace(): void {
  buffer.length = 0;
  seq = 0;
}
