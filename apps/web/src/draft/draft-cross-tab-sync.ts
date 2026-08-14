"use client";

export type DraftCrossTabSyncMessage = {
  readonly sourceId: string;
  readonly action: "saved" | "cleared";
  readonly emittedAt: number;
};

const DRAFT_CROSS_TAB_STORAGE_PREFIX = "app-tour.draft-sync";
const DRAFT_CROSS_TAB_TAB_ID_KEY = "app-tour.draft-sync.tab-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDraftCrossTabSourceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }
  try {
    const existing = window.sessionStorage.getItem(DRAFT_CROSS_TAB_TAB_ID_KEY);
    if (existing != null && existing.trim().length > 0) {
      return existing;
    }
    const next = randomId();
    window.sessionStorage.setItem(DRAFT_CROSS_TAB_TAB_ID_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

export function buildDraftCrossTabChannelKey(
  workspaceId: string,
  namespace: string,
  draftKey: string
): string {
  return [workspaceId.trim(), namespace.trim(), draftKey.trim()].join(":");
}

export function buildDraftCrossTabStorageKey(channelKey: string): string {
  return `${DRAFT_CROSS_TAB_STORAGE_PREFIX}:${channelKey}`;
}

export function publishDraftCrossTabMessage(
  channelKey: string,
  message: DraftCrossTabSyncMessage
): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(message);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(buildDraftCrossTabStorageKey(channelKey));
    channel.postMessage(payload);
    channel.close();
  }

  try {
    window.localStorage.setItem(buildDraftCrossTabStorageKey(channelKey), payload);
    window.localStorage.removeItem(buildDraftCrossTabStorageKey(channelKey));
  } catch {
    // Ignore storage write failures; BroadcastChannel may still deliver the update.
  }
}

function parseDraftCrossTabMessage(raw: unknown): DraftCrossTabSyncMessage | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.sourceId !== "string" ||
      (parsed.action !== "saved" && parsed.action !== "cleared") ||
      typeof parsed.emittedAt !== "number" ||
      !Number.isFinite(parsed.emittedAt)
    ) {
      return null;
    }
    return {
      sourceId: parsed.sourceId,
      action: parsed.action,
      emittedAt: parsed.emittedAt,
    };
  } catch {
    return null;
  }
}

export function subscribeDraftCrossTabMessages(
  channelKey: string,
  onMessage: (_message: DraftCrossTabSyncMessage) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const storageKey = buildDraftCrossTabStorageKey(channelKey);
  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(storageKey) : null;
  const handleRawMessage = (raw: unknown) => {
    const parsed = parseDraftCrossTabMessage(raw);
    if (parsed != null) {
      onMessage(parsed);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) {
      return;
    }
    handleRawMessage(event.newValue);
  };

  channel?.addEventListener("message", (event) => {
    handleRawMessage(event.data);
  });
  window.addEventListener("storage", handleStorage);

  return () => {
    channel?.close();
    window.removeEventListener("storage", handleStorage);
  };
}
