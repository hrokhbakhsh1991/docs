import type { DraftSyncPayload } from "@app-tour/draft-engine";

export type MockDraftJournalEntry = {
  readonly method: "GET" | "PATCH" | "DELETE";
  readonly version?: number;
  readonly stepIndex?: number;
  readonly freshStart?: boolean;
  readonly signalAborted: boolean;
  readonly at: number;
};

type MockWorkspaceDraftServerOptions = {
  readonly workspaceId: string;
  readonly namespace: string;
  readonly key: string;
  readonly slowPatchGate?: Promise<void> & { resolve?: () => void };
};

function draftPath(workspaceId: string, namespace: string, key: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/drafts/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
}

function readStepIndex(data: unknown): number | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const meta = (data as { meta?: { currentStepIndex?: number; freshStart?: boolean } }).meta;
  return typeof meta?.currentStepIndex === "number" ? meta.currentStepIndex : undefined;
}

function readFreshStart(data: unknown): boolean | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const meta = (data as { meta?: { freshStart?: boolean } }).meta;
  return meta?.freshStart === true ? true : undefined;
}

export function createSlowPatchGate(): Promise<void> & { resolve: () => void } {
  let resolveGate: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  }) as Promise<void> & { resolve: () => void };
  gate.resolve = () => resolveGate?.();
  return gate;
}

/** In-memory BFF draft store + request journal for integration specs. */
export function createMockWorkspaceDraftServer<T>(options: MockWorkspaceDraftServerOptions) {
  const path = draftPath(options.workspaceId, options.namespace, options.key);
  let row: DraftSyncPayload<T> | null = null;
  const journal: MockDraftJournalEntry[] = [];

  const record = (
    method: MockDraftJournalEntry["method"],
    init: RequestInit | undefined,
    extra: Pick<MockDraftJournalEntry, "version" | "stepIndex" | "freshStart"> = {}
  ): void => {
    journal.push({
      method,
      signalAborted: init?.signal?.aborted === true,
      at: journal.length,
      ...extra,
    });
  };

  const fetchImpl = (async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes(path)) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    }

    const method = init?.method ?? "GET";

    if (method === "GET") {
      record("GET", init);
      if (row === null) {
        return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
      }
      return new Response(JSON.stringify(row), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      record("DELETE", init);
      row = null;
      return new Response(null, { status: 204 });
    }

    if (method === "PATCH") {
      if (options.slowPatchGate != null) {
        await options.slowPatchGate;
      }
      if (init?.signal?.aborted === true) {
        record("PATCH", init);
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const body =
        init?.body != null && typeof init.body === "string"
          ? (JSON.parse(init.body) as DraftSyncPayload<T>)
          : null;
      if (body == null) {
        return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400 });
      }

      record("PATCH", init, {
        version: body.version,
        stepIndex: readStepIndex(body.data),
        freshStart: readFreshStart(body.data),
      });

      if (row !== null && body.version !== row.version) {
        return new Response(JSON.stringify(row), { status: 409 });
      }

      const nextVersion = row === null ? 1 : row.version + 1;
      row = {
        data: structuredClone(body.data),
        version: nextVersion,
        schemaVersion: body.schemaVersion,
        lastModified: body.lastModified,
      };
      return new Response(JSON.stringify(row), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }) as typeof fetch;

  return {
    journal,
    fetchImpl,
    seed(payload: DraftSyncPayload<T>): void {
      row = structuredClone(payload);
    },
    snapshot(): DraftSyncPayload<T> | null {
      return row === null ? null : structuredClone(row);
    },
    resetJournal(): void {
      journal.length = 0;
    },
  };
}

export function journalMethodsAfter(
  journal: readonly MockDraftJournalEntry[],
  method: MockDraftJournalEntry["method"],
  afterIndex: number
): readonly MockDraftJournalEntry[] {
  return journal.filter((entry, index) => index > afterIndex && entry.method === method);
}
