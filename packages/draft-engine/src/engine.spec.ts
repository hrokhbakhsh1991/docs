import assert from "node:assert/strict";
import test from "node:test";

import { DraftEngine } from "./engine";
import { DraftConflictError, type DraftEngineState, type DraftSyncPayload } from "./types";

type TestData = { value: string };

function payload(
  data: TestData,
  version = 1,
  lastModified = Date.now(),
): DraftSyncPayload<TestData> {
  return { data, version, lastModified };
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
  const pushLog: string[] = [];

  const engine = new DraftEngine<TestData>({
    id: "test",
    conflictStrategy: "SERVER_WINS",
    debounceMs: 5,
    onFetch: async () => null,
    onPush: async (p) => {
      pushCount += 1;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      pushLog.push(p.data.value);
      await sleep(30);
      concurrent -= 1;
      return { ...p, version: p.version + 1 };
    },
  });

  await engine.initialize();
  engine.update({ value: "first" });
  await sleep(10);

  engine.update({ value: "second" });
  await sleep(60);

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
