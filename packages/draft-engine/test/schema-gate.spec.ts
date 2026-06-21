import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DraftEngine } from "../src/engine";
import type { DraftSchemaGate } from "../src/types";

type TestData = { value: string };

function payload(data: TestData, version = 1) {
  return {
    data,
    version,
    schemaVersion: 1,
    lastModified: Date.now(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("schema-gate.spec.ts — WEB-P11-HERMETIC-01", () => {
  test("doPush aborts and transitions to QUARANTINED when schemaGate fails", async () => {
    let pushCount = 0;
    const gate: DraftSchemaGate<TestData> = () => ({
      ok: false,
      issues: [{ code: "TEST_GATE_FAIL" }],
    });

    const engine = new DraftEngine<TestData>({
      id: "hermetic-01",
      conflictStrategy: "SERVER_WINS",
      debounceMs: 5,
      schemaGate: gate,
      onFetch: async () => null,
      onPush: async (p) => {
        pushCount += 1;
        return payload(p.data, p.version + 1);
      },
    });

    await engine.initialize();
    engine.setDraftData({ value: "bad" });
    await sleep(30);

    assert.equal(pushCount, 0);
    assert.equal(engine.getState().status, "QUARANTINED");
    assert.deepEqual(engine.getState().schemaIssues, [{ code: "TEST_GATE_FAIL" }]);
  });

  test("setDraftData remains writable while QUARANTINED", async () => {
    const gate: DraftSchemaGate<TestData> = () => ({
      ok: false,
      issues: [{ code: "TEST_GATE_FAIL" }],
    });

    const engine = new DraftEngine<TestData>({
      id: "hermetic-01-ui",
      conflictStrategy: "SERVER_WINS",
      debounceMs: 5,
      schemaGate: gate,
      onFetch: async () => null,
      onPush: async (p) => payload(p.data, p.version + 1),
    });

    await engine.initialize();
    engine.setDraftData({ value: "first" });
    await sleep(30);
    assert.equal(engine.getState().status, "QUARANTINED");

    engine.setDraftData({ value: "fixed" });
    assert.equal(engine.getState().status, "QUARANTINED");
    assert.equal(engine.getState().data?.value, "fixed");
  });
});

describe("schema-gate.spec.ts — WEB-P11-HERMETIC-02", () => {
  test("flushKeepalive does not call onPush when schemaGate fails", async () => {
    let pushCount = 0;
    const gate: DraftSchemaGate<TestData> = () => ({
      ok: false,
      issues: [{ code: "KEEPALIVE_BLOCKED" }],
    });

    const engine = new DraftEngine<TestData>({
      id: "hermetic-02",
      conflictStrategy: "SERVER_WINS",
      schemaGate: gate,
      onFetch: async () => null,
      onPush: async (p, options) => {
        pushCount += 1;
        assert.equal(options?.keepalive, true);
        return payload(p.data, p.version + 1);
      },
    });

    await engine.initialize();
    engine.setDraftData({ value: "unload" });
    engine.flushKeepalive();
    await sleep(20);

    assert.equal(pushCount, 0);
    assert.equal(engine.getState().status, "QUARANTINED");
  });

  test("flushKeepalive is no-op when already QUARANTINED (zero egress)", async () => {
    let pushCount = 0;
    const gate: DraftSchemaGate<TestData> = () => ({
      ok: false,
      issues: [{ code: "ALREADY_QUARANTINED" }],
    });

    const engine = new DraftEngine<TestData>({
      id: "hermetic-02-quarantined",
      conflictStrategy: "SERVER_WINS",
      debounceMs: 5,
      schemaGate: gate,
      onFetch: async () => payload({ value: "remote" }, 1),
      onPush: async (p, options) => {
        pushCount += 1;
        return payload(p.data, p.version + 1);
      },
    });

    await engine.initialize();
    engine.setDraftData({ value: "bad" });
    await sleep(30);
    assert.equal(engine.getState().status, "QUARANTINED");

    engine.flushKeepalive();
    await sleep(20);
    assert.equal(pushCount, 0);
    assert.equal(engine.getState().status, "QUARANTINED");
  });
});

describe("schema-gate.spec.ts — EC-04 quarantine recovery", () => {
  test("QUARANTINED + flush with passing gate → SYNCING → IDLE", async () => {
    let pushCount = 0;
    let gateFail = true;
    const gate: DraftSchemaGate<TestData> = (candidate) => {
      if (gateFail) {
        return { ok: false, issues: [{ code: "TEMP_FAIL" }] };
      }
      return { ok: true, value: candidate };
    };

    const engine = new DraftEngine<TestData>({
      id: "ec-04",
      conflictStrategy: "SERVER_WINS",
      debounceMs: 5,
      schemaGate: gate,
      onFetch: async () => payload({ value: "remote" }, 1),
      onPush: async (p) => {
        pushCount += 1;
        return payload(p.data, p.version + 1);
      },
    });

    await engine.initialize();
    engine.setDraftData({ value: "edit" });
    await sleep(30);
    assert.equal(engine.getState().status, "QUARANTINED");

    gateFail = false;
    await engine.retry();
    assert.equal(pushCount, 1);
    assert.equal(engine.getState().status, "IDLE");
  });

  test("revertToLastValid restores snapshot and exits QUARANTINED", async () => {
    let gateFail = false;
    const gate: DraftSchemaGate<TestData> = (candidate) => {
      if (gateFail) {
        return { ok: false, issues: [{ code: "TEMP_FAIL" }] };
      }
      return { ok: true, value: candidate };
    };

    const engine = new DraftEngine<TestData>({
      id: "revert-cta",
      conflictStrategy: "SERVER_WINS",
      debounceMs: 5,
      schemaGate: gate,
      onFetch: async () => payload({ value: "remote" }, 2),
      onPush: async (p) => payload(p.data, p.version + 1),
    });

    await engine.initialize();
    assert.equal(engine.getState().data?.value, "remote");
    assert.equal(engine.hasLastValidSnapshot(), true);

    gateFail = true;
    engine.setDraftData({ value: "broken" });
    await sleep(30);
    assert.equal(engine.getState().status, "QUARANTINED");

    engine.revertToLastValid();
    assert.equal(engine.getState().status, "IDLE");
    assert.equal(engine.getState().data?.value, "remote");
    assert.equal(engine.getState().version, 2);
    assert.equal(engine.getState().schemaIssues, undefined);
  });
});
