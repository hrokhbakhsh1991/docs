import assert from "node:assert/strict";
import test from "node:test";

import { DraftEngine } from "../src/engine";
import { DraftConflictError, type DraftEngineState, type DraftSchemaGate, type DraftSyncEvent, type DraftSyncPayload } from "../src/types";

type TestData = { value: string };

function payload(
  data: TestData,
  version = 1,
  lastModified = Date.now(),
  schemaVersion = 1,
): DraftSyncPayload<TestData> {
  return { data, version, schemaVersion, lastModified };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("initialize loads payload from onFetch and sets IDLE", async () => {
  const fetched = payload({ value: "initial" }, 3, 1000);
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => p,
  });

  await engine.initialize();

  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "initial" });
  assert.equal(state.version, 3);
  assert.equal(state.lastModified, 1000);
});

test("initialize with null onFetch keeps empty state", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p) => p,
  });

  await engine.initialize();

  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.equal(state.data, null);
  assert.equal(state.version, 0);
});

test("initialize with autoApply false marks DRAFT_AVAILABLE", async () => {
  const fetched = payload({ value: "server" }, 7, 7000);
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => p,
  });

  await engine.initialize();

  const state = engine.getState();
  assert.equal(state.status, "DRAFT_AVAILABLE");
  assert.equal(state.data, null);
  assert.equal(state.pendingDraft?.version, 7);
  assert.deepEqual(state.pendingDraft?.data, { value: "server" });
});

test("applyDraft hydrates pending server draft", async () => {
  const fetched = payload({ value: "server" }, 4, 4444);
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => p,
  });

  await engine.initialize();
  engine.applyDraft();

  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "server" });
  assert.equal(state.version, 4);
  assert.equal(state.pendingDraft, undefined);
});

test("clearDraft calls onAbortInFlightPush before onDelete", async () => {
  let deleteCalls = 0;
  let aborted = false;
  const fetched = payload({ value: "server" }, 2, 2222);
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    onAbortInFlightPush: () => {
      aborted = true;
    },
    onFetch: async () => fetched,
    onPush: async (p) => p,
    onDelete: async () => {
      assert.ok(aborted);
      deleteCalls += 1;
    },
  });

  await engine.initialize();
  await engine.clearDraft();

  const state = engine.getState();
  assert.equal(deleteCalls, 1);
  assert.equal(state.status, "IDLE");
  assert.equal(state.data, null);
  assert.equal(state.version, 0);
  assert.equal(state.pendingDraft, undefined);
});

test("clearDraftAndReset deletes remote then applies reset without data=null notify", async () => {
  const snapshots: Array<TestData | null> = [];
  let deleteCalls = 0;
  const fetched = payload({ value: "server" }, 2, 2222);
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => ({ ...p, version: 1 }),
    onDelete: async () => {
      deleteCalls += 1;
    },
  });
  engine.subscribe((state) => {
    snapshots.push(state.data);
  });

  await engine.initialize();
  snapshots.length = 0;
  await engine.clearDraftAndReset({ value: "fresh" });

  assert.equal(deleteCalls, 1);
  const state = engine.getState();
  assert.equal(state.data?.value, "fresh");
  assert.equal(state.status, "IDLE");
  assert.equal(snapshots.includes(null), false);
});

test("clearDraft calls onDelete and clears local state", async () => {
  let deleteCalls = 0;
  const fetched = payload({ value: "server" }, 2, 2222);
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => p,
    onDelete: async () => {
      deleteCalls += 1;
    },
  });

  await engine.initialize();
  await engine.clearDraft();

  const state = engine.getState();
  assert.equal(deleteCalls, 1);
  assert.equal(state.status, "IDLE");
  assert.equal(state.data, null);
  assert.equal(state.version, 0);
  assert.equal(state.pendingDraft, undefined);
});

test("clearDraft awaits in-flight push, deletes, and ignores stale push side effects", async () => {
  let deleteCalls = 0;
  let pushCalls = 0;
  let resolvePush: (() => void) | undefined;
  const pushGate = new Promise<void>((resolve) => {
    resolvePush = resolve;
  });

  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCalls += 1;
      await pushGate;
      return { ...p, version: p.version + 1 };
    },
    onDelete: async () => {
      deleteCalls += 1;
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "stale" });
  const flushPromise = engine.flush();
  await sleep(0);
  assert.equal(engine.getState().status, "SYNCING");
  assert.equal(pushCalls, 1);

  const clearPromise = engine.clearDraft();
  resolvePush?.();
  await Promise.all([flushPromise, clearPromise]);

  assert.equal(pushCalls, 1);
  assert.equal(deleteCalls, 1);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.equal(state.data, null);
  assert.equal(state.version, 0);
});

test("clearDraft resets pendingSync so queued flush does not run after clear", async () => {
  let deleteCalls = 0;
  let pushCalls = 0;
  let resolvePush: (() => void) | undefined;
  const pushGate = new Promise<void>((resolve) => {
    resolvePush = resolve;
  });

  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p) => {
      pushCalls += 1;
      await pushGate;
      return { ...p, version: p.version + 1 };
    },
    onDelete: async () => {
      deleteCalls += 1;
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "first" });
  const firstFlush = engine.flush();
  await sleep(0);
  engine.setDraftData({ value: "second" });
  void engine.flush();

  const clearPromise = engine.clearDraft();
  resolvePush?.();
  await Promise.all([firstFlush, clearPromise]);

  assert.equal(deleteCalls, 1);
  assert.equal(pushCalls, 1);
  assert.equal(engine.getState().data, null);
});

test("flush waits for queued update behind an in-flight push", async () => {
  const pushed: DraftSyncPayload<TestData>[] = [];
  let resolveFirstPush: (() => void) | undefined;
  const firstPushGate = new Promise<void>((resolve) => {
    resolveFirstPush = resolve;
  });

  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p) => {
      pushed.push(p);
      if (pushed.length === 1) {
        await firstPushGate;
      }
      return { ...p, version: pushed.length };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "field-edit" });
  const firstFlush = engine.flush();
  await sleep(0);
  assert.equal(engine.getState().status, "SYNCING");

  engine.setDraftData({ value: "step-change" });
  const queuedFlush = engine.flush();
  resolveFirstPush?.();
  await Promise.all([firstFlush, queuedFlush]);

  assert.equal(pushed.length, 2);
  assert.deepEqual(pushed.map((entry) => entry.data.value), ["field-edit", "step-change"]);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "step-change" });
  assert.equal(state.version, 2);
});

test("initialize sets ERROR when onFetch throws", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => {
      throw new Error("fetch failed");
    },
    onPush: async (p) => p,
  });

  await engine.initialize();

  const state = engine.getState();
  assert.equal(state.status, "ERROR");
  assert.match(state.error?.message ?? "", /fetch failed/);
});

test("flush pushes immediately without waiting for debounce", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5_000,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "dirty" });
  await engine.flush();

  assert.equal(pushCount, 1);
  assert.equal(engine.getState().status, "IDLE");
});

test("update debounces onPush", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 20,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.update({ value: "a" });
  engine.update({ value: "b" });
  engine.update({ value: "c" });

  assert.equal(pushCount, 0);
  await sleep(40);

  assert.equal(pushCount, 1);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "c" });
  assert.equal(state.version, 1);
});

test("mutex ensures only one onPush at a time and coalesces pending updates", async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  let pushCount = 0;

  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(30);
      concurrent -= 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.update({ value: "first" });
  await sleep(10);

  engine.update({ value: "second" });
  await sleep(100);

  assert.equal(maxConcurrent, 1);
  assert.ok(pushCount >= 2);
  assert.deepEqual(engine.getState().data, { value: "second" });
  assert.equal(engine.getState().status, "IDLE");
});

test("onPush failure sets ERROR", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async () => {
      throw new Error("push failed");
    },
  });

  await engine.initialize();
  engine.update({ value: "x" });
  await sleep(20);

  const state = engine.getState();
  assert.equal(state.status, "ERROR");
  assert.match(state.error?.message ?? "", /push failed/);
});

test("SERVER_WINS conflict applies server payload", async () => {
  const server = payload({ value: "server" }, 5, 5000);
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async () => {
      throw new DraftConflictError(server);
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(20);

  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "server" });
  assert.equal(state.version, 5);
  assert.equal(state.conflictReloadNotice, true);

  engine.setDraftData({ value: "edited-after-reload" });
  assert.equal(engine.getState().conflictReloadNotice, undefined);
});

test("CLIENT_WINS conflict retries push with local data", async () => {
  let attempts = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "CLIENT_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      attempts += 1;
      if (attempts === 1) {
        throw new DraftConflictError(payload({ value: "server" }, 9, 9000));
      }
      assert.deepEqual(p.data, { value: "local" });
      return { ...p, version: 10 };
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(20);

  assert.equal(attempts, 2);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "local" });
  assert.equal(state.version, 10);
});

test("MERGE conflict merges data and schedules another sync", async () => {
  let pushCount = 0;
  let mergeCalls = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "MERGE",
    debounceMs: 5,
    merge: (local, server) => {
      mergeCalls += 1;
      return { value: `${local.value}+${server.value}` };
    },
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      if (pushCount === 1) {
        throw new DraftConflictError(payload({ value: "server" }, 2, 2000));
      }
      return { ...p, version: 3 };
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(40);

  assert.equal(mergeCalls, 1);
  assert.ok(pushCount >= 2);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "local+server" });
  assert.equal(state.version, 3);
});

test("REFETCH_REAPPLY conflict re-fetches, merges local, hydrates quietly without retry push", async () => {
  let fetchCalls = 0;
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 5,
    merge: (local, server) => ({ value: `${local.value}+${server.value}` }),
    onFetch: async () => {
      fetchCalls += 1;
      return payload({ value: "fresh-server" }, 5, 5000);
    },
    onPush: async () => {
      pushCount += 1;
      throw new DraftConflictError(payload({ value: "stale-server" }, 4, 4000));
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(60);

  assert.ok(fetchCalls >= 1);
  assert.equal(pushCount, 1);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.equal(state.error, undefined);
  assert.deepEqual(state.data, { value: "local+fresh-server" });
  assert.equal(state.version, 5);
  assert.equal(state.lastModified, 5000);
});

test("REFETCH_REAPPLY freshStart 409 re-deletes and re-pushes at version 0", async () => {
  type FreshData = { readonly value: string; readonly freshStart?: boolean };
  let deleteCalls = 0;
  const pushVersions: number[] = [];
  let pushAttempt = 0;
  const staleServer = payload({ value: "stale-server" }, 7, 7000);

  const engine = new DraftEngine<FreshData>({
    id: "fresh-start-409",
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 5,
    shouldBypassServerVersionAdoption: (data) => data.freshStart === true,
    merge: (local, server) => ({ ...server, ...local }),
    onFetch: async () => staleServer as DraftSyncPayload<FreshData>,
    onDelete: async () => {
      deleteCalls += 1;
    },
    onPush: async (p) => {
      pushVersions.push(p.version);
      pushAttempt += 1;
      if (pushAttempt === 1) {
        throw new DraftConflictError(staleServer as DraftSyncPayload<FreshData>);
      }
      return payload(p.data, p.version + 1, p.lastModified + 1) as DraftSyncPayload<FreshData>;
    },
  });

  engine.setDraftData({ value: "reset", freshStart: true });
  await engine.flush();

  assert.ok(deleteCalls >= 1);
  assert.deepEqual(pushVersions, [0, 0]);
  assert.equal(engine.getState().status, "IDLE");
  assert.equal(engine.getState().version, 1);
  assert.equal(engine.getState().data?.value, "reset");
});

test("setDraftData remote with version updates version without onPush", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 20,
    onFetch: async () => payload({ value: "initial" }, 1, 100),
    onPush: async (p) => {
      pushCount += 1;
      return p;
    },
  });

  await engine.initialize();
  assert.equal(engine.getState().status, "IDLE");

  engine.setDraftData({ value: "quiet" }, { source: "remote", version: 9, lastModified: 9000 });
  await sleep(40);

  assert.equal(pushCount, 0);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "quiet" });
  assert.equal(state.version, 9);
  assert.equal(state.lastModified, 9000);
});

test("MERGE without merge fn sets ERROR", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "MERGE",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async () => {
      throw new DraftConflictError(payload({ value: "server" }, 1, 1));
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(20);

  const state = engine.getState();
  assert.equal(state.status, "ERROR");
  assert.match(state.error?.message ?? "", /requires config.merge/);
});

test("subscribe notifies on state changes and unsubscribes cleanly", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => payload({ value: "sub" }, 2, 2000),
    onPush: async (p) => p,
  });

  const seen: DraftEngineState<TestData>["status"][] = [];
  const unsub = engine.subscribe((s) => {
    seen.push(s.status);
  });

  assert.ok(seen.includes("IDLE"));
  await engine.initialize();
  assert.ok(seen.includes("SYNCING"));

  unsub();
  const countBefore = seen.length;
  engine.update({ value: "after-unsub" });
  await sleep(20);
  assert.equal(seen.length, countBefore);
});

test("retry re-initializes after fetch error", async () => {
  let fetchAttempts = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => {
      fetchAttempts += 1;
      if (fetchAttempts === 1) {
        throw new Error("fetch failed");
      }
      return payload({ value: "recovered" }, 1, 100);
    },
    onPush: async (p) => p,
  });

  await engine.initialize();
  assert.equal(engine.getState().status, "ERROR");

  await engine.retry();
  assert.equal(engine.getState().status, "IDLE");
  assert.deepEqual(engine.getState().data, { value: "recovered" });
});

test("retry re-pushes after push error", async () => {
  let pushAttempts = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      pushAttempts += 1;
      if (pushAttempts === 1) {
        throw new Error("push failed");
      }
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(20);
  assert.equal(engine.getState().status, "ERROR");

  await engine.retry();
  assert.equal(engine.getState().status, "IDLE");
  assert.equal(pushAttempts, 2);
});

test("setDraftData with remote source hydrates without DIRTY or onPush", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 20,
    onFetch: async () => payload({ value: "initial" }, 1, 100),
    onPush: async (p) => {
      pushCount += 1;
      return p;
    },
  });

  await engine.initialize();
  assert.equal(engine.getState().status, "IDLE");

  engine.setDraftData({ value: "quiet" }, { source: "remote" });
  await sleep(40);

  assert.equal(pushCount, 0);
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "quiet" });
});

test("initialize and applyDraft hydrate remotely without scheduling push", async () => {
  let pushCount = 0;
  const fetched = payload({ value: "server" }, 9, 9000);
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    debounceMs: 20,
    onFetch: async () => fetched,
    onPush: async (p) => {
      pushCount += 1;
      return p;
    },
  });

  await engine.initialize();
  await sleep(40);
  assert.equal(pushCount, 0);
  assert.equal(engine.getState().status, "DRAFT_AVAILABLE");

  engine.applyDraft();
  await sleep(40);
  assert.equal(pushCount, 0);
  assert.equal(engine.getState().status, "IDLE");
  assert.deepEqual(engine.getState().data, { value: "server" });
  assert.equal(engine.getState().version, 9);
});

test("getState returns readonly snapshot", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => payload({ value: "snap" }, 1, 100),
    onPush: async (p) => p,
  });

  await engine.initialize();
  const state = engine.getState();
  assert.equal(state.status, "IDLE");
  assert.deepEqual(state.data, { value: "snap" });
});

test("retry is a no-op when status is not ERROR", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => payload({ value: "initial" }, 1, 100),
    onPush: async (p) => {
      pushCount += 1;
      return p;
    },
  });

  await engine.initialize();
  await engine.retry();

  assert.equal(engine.getState().status, "IDLE");
  assert.equal(pushCount, 0);
});

test("setDraftData from user is ignored while DRAFT_AVAILABLE", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    autoApply: false,
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => payload({ value: "server" }, 2, 200),
    onPush: async (p) => {
      pushCount += 1;
      return p;
    },
  });

  await engine.initialize();
  assert.equal(engine.getState().status, "DRAFT_AVAILABLE");

  engine.setDraftData({ value: "local-edit" }, { source: "user" });
  await sleep(20);

  const state = engine.getState();
  assert.equal(state.status, "DRAFT_AVAILABLE");
  assert.equal(state.data, null);
  assert.equal(pushCount, 0);
});

test("clearDraft throws when delete handler is not provided", async () => {
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p) => p,
  });

  await assert.rejects(() => engine.clearDraft(), /clearDraft requires config.onDelete/);
});

test("default debounce is 500ms when debounceMs omitted", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.update({ value: "debounced" });
  await sleep(20);
  assert.equal(pushCount, 0);
  await sleep(520);
  assert.equal(pushCount, 1);
});

test("flushKeepalive calls onPush with keepalive when DIRTY", async () => {
  let keepalivePush = false;
  const engine = new DraftEngine<TestData>({
    id: "test-keepalive",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p, options) => {
      if (options?.keepalive === true) {
        keepalivePush = true;
      }
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "unload" });
  assert.equal(engine.getState().status, "DIRTY");

  engine.flushKeepalive();
  await sleep(20);
  assert.equal(keepalivePush, true);
  assert.equal(engine.getState().status, "DIRTY");
});

test("flushKeepalive is no-op when IDLE", async () => {
  let pushCount = 0;
  const engine = new DraftEngine<TestData>({
    id: "test-keepalive-idle",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.flushKeepalive();
  await sleep(20);
  assert.equal(pushCount, 0);
});

test("schemaGate failure on push transitions to QUARANTINED without onPush (WEB-P11-HERMETIC-01 engine.spec)", async () => {
  let pushCount = 0;
  const gate: DraftSchemaGate<TestData> = () => ({
    ok: false,
    issues: [{ code: "ENGINE_SPEC_GATE_FAIL" }],
  });

  const engine = new DraftEngine<TestData>({
    id: "engine-spec-quarantine",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    schemaGate: gate,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "blocked" });
  await engine.flush();

  assert.equal(pushCount, 0);
  assert.equal(engine.getState().status, "QUARANTINED");
  assert.deepEqual(engine.getState().schemaIssues, [{ code: "ENGINE_SPEC_GATE_FAIL" }]);
});

test("QUARANTINED blocks debounced auto-sync scheduling (network layer locked)", async () => {
  let pushCount = 0;
  const gate: DraftSchemaGate<TestData> = () => ({
    ok: false,
    issues: [{ code: "NO_AUTO_SYNC" }],
  });

  const engine = new DraftEngine<TestData>({
    id: "engine-spec-quarantine-debounce",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    schemaGate: gate,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "first" });
  await engine.flush();
  assert.equal(engine.getState().status, "QUARANTINED");

  engine.setDraftData({ value: "edited-while-quarantined" });
  await sleep(30);
  assert.equal(pushCount, 0);
  assert.equal(engine.getState().status, "QUARANTINED");
  assert.equal(engine.getState().data?.value, "edited-while-quarantined");
});

test("flushKeepalive from QUARANTINED is zero egress (WEB-P11-HERMETIC-02 engine.spec)", async () => {
  let pushCount = 0;
  const gate: DraftSchemaGate<TestData> = () => ({
    ok: false,
    issues: [{ code: "KEEPALIVE_BLOCK" }],
  });

  const engine = new DraftEngine<TestData>({
    id: "engine-spec-keepalive-quarantine",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    schemaGate: gate,
    onFetch: async () => payload({ value: "remote" }, 1),
    onPush: async (p, options) => {
      pushCount += 1;
      assert.equal(options?.keepalive, true);
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "bad" });
  await engine.flush();
  assert.equal(engine.getState().status, "QUARANTINED");

  engine.flushKeepalive();
  await sleep(20);
  assert.equal(pushCount, 0);
  assert.equal(engine.getState().status, "QUARANTINED");
});

test("initialize commits ack cache (Track B)", async () => {
  const fetched = payload({ value: "initial" }, 3, 1000);
  const engine = new DraftEngine<TestData>({
    id: "test-ack-init",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => p,
  });

  await engine.initialize();

  const ack = engine.getAckCacheForTests();
  assert.ok(ack != null);
  assert.equal(ack.version, 3);
  assert.equal(ack.ackSource, "initialize");
});

test("clearDraft clears ack cache (Track B)", async () => {
  const fetched = payload({ value: "initial" }, 2, 2000);
  const engine = new DraftEngine<TestData>({
    id: "test-ack-clear",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => p,
    onDelete: async () => {},
  });

  await engine.initialize();
  assert.ok(engine.getAckCacheForTests() != null);
  await engine.clearDraft();
  assert.equal(engine.getAckCacheForTests(), null);
});

test("successful push commits patch200 ack (Track B)", async () => {
  const fetched = payload({ value: "initial" }, 1, 1000);
  const engine = new DraftEngine<TestData>({
    id: "test-ack-push",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => payload({ value: "saved" }, p.version + 1, p.lastModified + 1),
  });

  await engine.initialize();
  engine.setDraftData({ value: "edited" });
  await engine.flush();

  const ack = engine.getAckCacheForTests();
  assert.ok(ack != null);
  assert.equal(ack.version, 2);
  assert.equal(ack.ackSource, "patch200");
  assert.deepEqual(ack.data, { value: "saved" });
});

test("ack cache miss refetches before push (Track B B-7)", async () => {
  let fetchCount = 0;
  const fetched = payload({ value: "server" }, 5, 5000);
  const engine = new DraftEngine<TestData>({
    id: "test-ack-refetch",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => {
      fetchCount += 1;
      return fetched;
    },
    onPush: async (p) => payload(p.data, p.version + 1, p.lastModified + 1),
  });

  await engine.initialize();
  engine.clearAckCacheForTests();
  engine.setDraftData({ value: "local-edit" });
  await engine.flush();

  assert.ok(fetchCount >= 2);
  const ack = engine.getAckCacheForTests();
  assert.ok(ack != null);
  assert.equal(ack.version, 6);
  assert.equal(ack.ackSource, "patch200");
});

test("shouldBypassServerVersionAdoption resets stale ack and pushes at version 0", async () => {
  type FreshData = { readonly value: string; readonly freshStart?: boolean };
  let pushedVersion = -1;
  const fetched = payload({ value: "server" }, 7, 7000);

  const engine = new DraftEngine<FreshData>({
    id: "test-fresh-start-bypass",
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 5,
    shouldBypassServerVersionAdoption: (data) => data.freshStart === true,
    onFetch: async () => fetched as DraftSyncPayload<FreshData>,
    onPush: async (p) => {
      pushedVersion = p.version;
      return payload(p.data, p.version + 1, p.lastModified + 1) as DraftSyncPayload<FreshData>;
    },
  });

  await engine.initialize();
  assert.equal(engine.getState().version, 7);
  engine.setDraftData({ value: "reset", freshStart: true });
  await engine.flush();

  assert.equal(pushedVersion, 0);
});

test("freshStart keeps ack version on subsequent pushes while meta stays freshStart", async () => {
  type FreshData = { readonly value: string; readonly freshStart?: boolean };
  const pushVersions: number[] = [];
  let serverVersion = 0;

  const engine = new DraftEngine<FreshData>({
    id: "test-fresh-start-subsequent",
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 5,
    shouldBypassServerVersionAdoption: (data) => data.freshStart === true,
    onFetch: async () =>
      serverVersion === 0
        ? null
        : (payload({ value: "server" }, serverVersion, 7000) as DraftSyncPayload<FreshData>),
    onPush: async (p) => {
      pushVersions.push(p.version);
      serverVersion = p.version === 0 ? 1 : p.version + 1;
      return payload(p.data, serverVersion, p.lastModified + 1) as DraftSyncPayload<FreshData>;
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "reset", freshStart: true });
  await engine.flush();
  assert.deepEqual(pushVersions, [0]);
  assert.equal(engine.getState().version, 1);

  engine.setDraftData({ value: "typed-after-reset", freshStart: true });
  await engine.flush();

  assert.deepEqual(pushVersions, [0, 1]);
  assert.equal(engine.getState().status, "IDLE");
  assert.equal(engine.getState().version, 2);
});

test("flushKeepalive does not commit ack cache (Track B)", async () => {
  const fetched = payload({ value: "initial" }, 1, 1000);
  const engine = new DraftEngine<TestData>({
    id: "test-ack-keepalive",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => fetched,
    onPush: async (p) => payload(p.data, p.version + 1, p.lastModified),
  });

  await engine.initialize();
  const ackBefore = engine.getAckCacheForTests();
  engine.setDraftData({ value: "unload" });
  engine.flushKeepalive();
  await sleep(20);
  const ackAfter = engine.getAckCacheForTests();
  assert.deepEqual(ackAfter, ackBefore);
});

test("patch200 commits ack when local edits continue during in-flight push (Track B INV-6)", async () => {
  const fetched = payload({ value: "initial" }, 1, 1000);
  let resolvePush: (() => void) | undefined;
  const pushGate = new Promise<void>((resolve) => {
    resolvePush = resolve;
  });

  const engine = new DraftEngine<TestData>({
    id: "test-ack-concurrent-edit",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => fetched,
    onPush: async (p) => {
      await pushGate;
      return payload({ value: "saved-on-server" }, p.version + 1, p.lastModified + 1);
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "first-edit" });
  const flushPromise = engine.flush();
  await sleep(0);
  engine.setDraftData({ value: "second-edit-during-push" });
  resolvePush?.();
  await flushPromise;

  const state = engine.getState();
  assert.equal(state.data?.value, "second-edit-during-push");
  assert.equal(state.status, "DIRTY");
  const ack = engine.getAckCacheForTests();
  assert.ok(ack != null);
  assert.equal(ack.version, 2);
  assert.equal(ack.ackSource, "patch200");
  assert.deepEqual(ack.data, { value: "saved-on-server" });
});

test("aborted push does not commit patch200 ack (Track B INV-6)", async () => {
  const fetched = payload({ value: "initial" }, 3, 3000);
  const engine = new DraftEngine<TestData>({
    id: "test-ack-abort",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => fetched,
    onPush: async () => {
      throw new Error("WORKSPACE_DRAFT_PATCH_ABORTED");
    },
  });

  await engine.initialize();
  const ackBefore = engine.getAckCacheForTests();
  engine.setDraftData({ value: "edited" });
  await engine.flush();
  assert.deepEqual(engine.getAckCacheForTests(), ackBefore);
});

type StripMetaData = { value: string; stripMe?: string };

test("normalizeRemote strips server-origin data on remote hydrate (Track B B-8)", async () => {
  const engine = new DraftEngine<StripMetaData>({
    id: "test-normalize-remote",
    conflictStrategy: "SERVER_WINS",
    normalizeRemote: (data) => {
      const { stripMe: _removed, ...rest } = data;
      return rest;
    },
    onFetch: async () => payload({ value: "initial", stripMe: "server-only" }, 2, 2000),
    onPush: async (p) => p,
  });

  await engine.initialize();

  assert.deepEqual(engine.getState().data, { value: "initial" });
  assert.equal(engine.getState().data?.stripMe, undefined);
});

test("REFETCH_REAPPLY runs schemaGate merge phase after merge (Track B B-3)", async () => {
  const gatePhases: string[] = [];
  const gate: DraftSchemaGate<TestData> = (candidate, ctx) => {
    gatePhases.push(ctx.phase);
    if (ctx.phase === "merge") {
      return { ok: true, value: { value: `${candidate.value}-sanitized` } };
    }
    return { ok: true, value: candidate };
  };

  const engine = new DraftEngine<TestData>({
    id: "test-merge-gate",
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 5,
    schemaGate: gate,
    merge: (local, server) => ({ value: `${local.value}+${server.value}` }),
    onFetch: async () => payload({ value: "fresh-server" }, 5, 5000),
    onPush: async () => {
      throw new DraftConflictError(payload({ value: "stale-server" }, 4, 4000));
    },
  });

  await engine.initialize();
  engine.update({ value: "local" });
  await sleep(60);

  assert.ok(gatePhases.includes("merge"));
  assert.deepEqual(engine.getState().data, { value: "local+fresh-server-sanitized" });
});

test("onDiagnostic emits push_start and push_success with same intentId", async () => {
  const events: DraftSyncEvent[] = [];
  const engine = new DraftEngine<TestData>({
    id: "diag-push",
    conflictStrategy: "SERVER_WINS",
    onDiagnostic: (event) => events.push(event),
    onFetch: async () => null,
    onPush: async (p) => ({ ...p, version: p.version + 1 }),
  });

  await engine.initialize();
  engine.setDraftData({ value: "x" });
  await engine.flush();

  const starts = events.filter((event) => event.type === "push_start");
  const successes = events.filter((event) => event.type === "push_success");
  assert.equal(starts.length, 1);
  assert.equal(successes.length, 1);
  assert.equal(starts[0]?.type === "push_start" && successes[0]?.type === "push_success" ? starts[0].intentId : null, successes[0]?.type === "push_success" ? successes[0].intentId : null);
});

test("onDiagnostic emits conflict on DraftConflictError", async () => {
  const events: DraftSyncEvent[] = [];
  const server = payload({ value: "server" }, 2, 2000);
  const engine = new DraftEngine<TestData>({
    id: "diag-conflict",
    conflictStrategy: "SERVER_WINS",
    onDiagnostic: (event) => events.push(event),
    onFetch: async () => payload({ value: "initial" }, 1, 1000),
    onPush: async () => {
      throw new DraftConflictError(server);
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "edited" });
  await engine.flush();

  const conflicts = events.filter((event) => event.type === "conflict");
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.type === "conflict" ? conflicts[0].strategy : null, "SERVER_WINS");
});

test("onDiagnostic emits error and sets ERROR status on push failure", async () => {
  const events: DraftSyncEvent[] = [];
  const engine = new DraftEngine<TestData>({
    id: "diag-error",
    conflictStrategy: "SERVER_WINS",
    onDiagnostic: (event) => events.push(event),
    onFetch: async () => null,
    onPush: async () => {
      throw new Error("WORKSPACE_DRAFT_PATCH_FAILED:422");
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "x" });
  await engine.flush();

  const errors = events.filter((event) => event.type === "error");
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.type === "error" ? errors[0].recoverable : null, false);
  assert.equal(engine.getState().status, "ERROR");
});

test("WORKSPACE_DRAFT_PATCH_ABORTED emits no error diagnostic", async () => {
  const events: DraftSyncEvent[] = [];
  const fetched = payload({ value: "initial" }, 3, 3000);
  const engine = new DraftEngine<TestData>({
    id: "diag-abort",
    conflictStrategy: "SERVER_WINS",
    onDiagnostic: (event) => events.push(event),
    onFetch: async () => fetched,
    onPush: async () => {
      throw new Error("WORKSPACE_DRAFT_PATCH_ABORTED");
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "edited" });
  await engine.flush();

  assert.ok(events.some((event) => event.type === "push_start"));
  assert.ok(!events.some((event) => event.type === "error"));
  assert.equal(engine.getState().status, "DIRTY");
});

test("getDebugSnapshot returns metadata without data blob", async () => {
  const engine = new DraftEngine<TestData>({
    id: "diag-snapshot",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => payload({ value: "initial" }, 2, 2000),
    onPush: async (p) => ({ ...p, version: p.version + 1 }),
  });

  await engine.initialize();
  const afterInit = engine.getDebugSnapshot();
  assert.equal(afterInit.status, "IDLE");
  assert.equal(afterInit.version, 2);
  assert.equal(afterInit.ackVersion, 2);
  assert.equal(afterInit.lastIntentId, null);
  assert.ok(!("data" in (afterInit as Record<string, unknown>)));

  engine.setDraftData({ value: "edited" });
  await engine.flush();
  const afterPush = engine.getDebugSnapshot();
  assert.equal(afterPush.status, "IDLE");
  assert.equal(afterPush.ackVersion, 3);
  assert.ok(afterPush.lastIntentId != null);
  assert.equal(afterPush.lastError, null);
});

test("setDraftData no-op when payload is structurally equal (prevents effect loops)", async () => {
  const pushes: unknown[] = [];
  const engine = new DraftEngine<TestData>({
    id: "test-setdata-dedup",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      pushes.push(p.data);
      return { ...p, version: p.version + 1 };
    },
  });

  engine.setDraftData({ value: "same" });
  await engine.flush();
  assert.equal(pushes.length, 1);

  engine.setDraftData({ value: "same" });
  await engine.flush();
  assert.equal(pushes.length, 1);
  assert.equal(engine.getState().status, "IDLE");
});

test("prePush gate clone with identical content settles IDLE (no push loop)", async () => {
  type MetaEnvelope = { form: { title: string }; meta: { step: number; freshStart?: boolean } };

  const schemaGate: DraftSchemaGate<MetaEnvelope> = (candidate, ctx) => {
    if (ctx.phase !== "prePush") {
      return { ok: true, value: candidate };
    }
    if (candidate.meta.freshStart === true) {
      return {
        ok: true,
        value: {
          form: candidate.form,
          meta: { ...candidate.meta, freshStart: true },
        },
      };
    }
    return { ok: true, value: candidate };
  };

  const engine = new DraftEngine<MetaEnvelope>({
    id: "test-prepush-clone-idle",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    schemaGate,
    onFetch: async () => null,
    onPush: async (p) => ({ ...p, version: p.version + 1 }),
  });

  const envelope: MetaEnvelope = {
    form: { title: "Hello" },
    meta: { step: 0, freshStart: true },
  };
  engine.setDraftData(envelope);
  await engine.flush();
  assert.equal(engine.getState().status, "IDLE");
});

test("getState data clone prevents consumer mutation of engine internals", async () => {
  const pushed: TestData[] = [];
  const engine = new DraftEngine<TestData>({
    id: "diag-immutable",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => payload({ value: "initial" }, 1, 1000),
    onPush: async (p) => {
      pushed.push(p.data);
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  const view = engine.getState().data;
  assert.ok(view != null);
  view.value = "mutated-by-consumer";
  engine.setDraftData({ value: "actual" });
  await engine.flush();
  assert.deepEqual(pushed.at(-1), { value: "actual" });
});

test("flushKeepalive emits recoverable error diagnostic on push failure", async () => {
  const events: DraftSyncEvent[] = [];
  const engine = new DraftEngine<TestData>({
    id: "diag-keepalive-error",
    conflictStrategy: "SERVER_WINS",
    onDiagnostic: (event) => events.push(event),
    onFetch: async () => null,
    onPush: async (p, options) => {
      if (options?.keepalive === true) {
        throw new Error("network down");
      }
      return p;
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "unload" });
  engine.flushKeepalive();
  await sleep(20);

  const errors = events.filter((event) => event.type === "error");
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.type === "error" ? errors[0].recoverable : null, true);
  assert.equal(engine.getState().status, "DIRTY");
});

test("doPush passes intentId to onPush options", async () => {
  let capturedIntentId: string | undefined;
  const engine = new DraftEngine<TestData>({
    id: "diag-intent-id",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => null,
    onPush: async (p, options) => {
      capturedIntentId = options?.intentId;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "x" });
  await engine.flush();

  assert.ok(capturedIntentId != null && capturedIntentId.length > 0);
});

test(
  "doPush retries 5xx errors before success",
  { timeout: 8000 },
  async () => {
    let attempts = 0;
    const engine = new DraftEngine<TestData>({
      id: "retry-5xx",
      conflictStrategy: "SERVER_WINS",
      onFetch: async () => null,
      onPush: async (p) => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("WORKSPACE_DRAFT_PATCH_FAILED:503");
        }
        return { ...p, version: p.version + 1 };
      },
    });

    await engine.initialize();
    engine.setDraftData({ value: "x" });
    await engine.flush();

    assert.equal(attempts, 3);
    assert.equal(engine.getState().status, "IDLE");
  }
);

test("doPush does not retry DraftConflictError", async () => {
  let attempts = 0;
  const server = payload({ value: "server" }, 2, 2000);
  const engine = new DraftEngine<TestData>({
    id: "no-retry-conflict",
    conflictStrategy: "SERVER_WINS",
    onFetch: async () => payload({ value: "initial" }, 1, 1000),
    onPush: async () => {
      attempts += 1;
      throw new DraftConflictError(server);
    },
  });

  await engine.initialize();
  engine.setDraftData({ value: "edited" });
  await engine.flush();

  assert.equal(attempts, 1);
});
